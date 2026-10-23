// End-to-end service flow on the real local stack (Supabase with Auth + Realtime, uvicorn, Vite dev).
// Four browser contexts: waiter, kitchen (1280×800), diner (390×844) and admin (1440×900).
// Usage: npm run e2e   (env: APP_URL, SUPABASE_URL, SUPABASE_ANON_KEY, CHROMIUM, E2E_TABLE, E2E_QR)
import { mkdirSync, readFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const APP = process.env.APP_URL ?? 'http://127.0.0.1:5173'
const API = `${APP}/api/v1`
const TABLE = process.env.E2E_TABLE ?? 'M2'
const QR = process.env.E2E_QR ?? 'dev-qr-m2-000000000000000000000000'
const PASSWORD = 'foody1234'
const SHOTS = 'smoke-shots/e2e'
const KITCHEN_LIMIT_MS = 3000

function envFile() {
  try {
    return Object.fromEntries(readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')
      .filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]))
  } catch {
    return {}
  }
}
const ENV = envFile()
const SUPABASE = process.env.SUPABASE_URL ?? ENV.VITE_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const ANON = process.env.SUPABASE_ANON_KEY ?? ENV.VITE_SUPABASE_ANON_KEY

const step = (msg) => console.log(`• ${msg}`)

async function tokenFor(email) {
  const res = await fetch(`${SUPABASE}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: PASSWORD }),
  })
  if (!res.ok) throw new Error(`login de ${email} falló: ${res.status}; ¿Supabase con Auth y la anon key en frontend/.env?`)
  return (await res.json()).access_token
}

/** The flow needs the table free; a closed one is released, anything else stops with a hint. */
async function preflight() {
  if (!ANON) throw new Error('falta VITE_SUPABASE_ANON_KEY en frontend/.env (o SUPABASE_ANON_KEY)')
  const auth = { Authorization: `Bearer ${await tokenFor('mesero@foody.local')}` }
  const tables = await (await fetch(`${API}/waiter/tables`, { headers: auth })).json()
  const table = tables.find((t) => t.code === TABLE)
  if (!table) throw new Error(`no existe la mesa ${TABLE}`)
  if (table.status === 'closed') await fetch(`${API}/waiter/tables/${table.id}/release`, { method: 'POST', headers: auth })
  else if (table.status !== 'free') throw new Error(`la mesa ${TABLE} está "${table.status}"; corre "npx supabase db reset" o usa E2E_TABLE/E2E_QR`)
}

async function staffPage(browser, email, viewport, home) {
  const page = await (await browser.newContext({ viewport })).newPage()
  page.on('pageerror', (e) => errors.push(`${email}: ${e.message}`))
  await page.goto(`${APP}/login`)
  await page.getByLabel('Correo').fill(email)
  await page.getByLabel('Contraseña').fill(PASSWORD)
  await page.getByRole('button', { name: 'Entrar' }).click()
  await page.waitForURL(new RegExp(`${home}$`))
  pages[email] = page
  return page
}

const errors = []
const pages = {}
mkdirSync(SHOTS, { recursive: true })
await preflight()
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' })
try {
  const desk = { width: 1280, height: 800 }
  const waiter = await staffPage(browser, 'mesero@foody.local', desk, '/mesero')
  const kitchen = await staffPage(browser, 'cocina@foody.local', desk, '/cocina')
  await kitchen.getByText('Conectado').waitFor({ timeout: 10_000 })
  step('mesero y cocina con sesión; cocina conectada a Realtime')

  await waiter.getByRole('button', { name: new RegExp(`^Mesa ${TABLE},`) }).click()
  await waiter.getByRole('button', { name: 'Abrir mesa' }).click()
  await waiter.getByRole('button', { name: new RegExp(`^Mesa ${TABLE}, Ocupada`) }).waitFor()
  await waiter.getByRole('button', { name: 'Cerrar' }).click()
  await waiter.screenshot({ path: `${SHOTS}/1-mesero-abre.png` })
  step(`mesero abrió ${TABLE}`)

  const diner = await (await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })).newPage()
  diner.on('pageerror', (e) => errors.push(`comensal: ${e.message}`))
  pages.comensal = diner
  await diner.goto(`${APP}/mesa/${QR}`)
  await diner.getByRole('button', { name: 'Saltar' }).click()
  await diner.getByRole('link', { name: /^Agregar / }).first().click()
  const dish = (await diner.getByRole('heading', { level: 1 }).textContent())?.trim()
  await diner.getByRole('button', { name: /^Agregar/ }).last().click()
  await diner.getByRole('link', { name: /ver pedido/i }).click()
  await diner.screenshot({ path: `${SHOTS}/2-comensal-pedido.png` })
  const sentAt = Date.now()
  await diner.getByRole('button', { name: /enviar a cocina/i }).click()
  await diner.getByRole('heading', { name: 'Tu cuenta' }).waitFor()
  step(`comensal ordenó ${dish}`)

  const ticket = kitchen.getByRole('article', { name: new RegExp(`mesa ${TABLE}$`) })
  await ticket.waitFor({ timeout: 10_000 })
  const latency = Date.now() - sentAt
  await kitchen.screenshot({ path: `${SHOTS}/3-cocina-recibe.png` })
  if (latency > KITCHEN_LIMIT_MS) throw new Error(`la orden tardó ${latency} ms en llegar a cocina (límite ${KITCHEN_LIMIT_MS})`)
  step(`la orden llegó a cocina sin recargar en ${latency} ms`)

  await ticket.getByRole('button', { name: 'Empezar' }).click()
  await ticket.getByRole('button', { name: 'Marcar lista' }).click()
  await ticket.getByText('Esperando al mesero').waitFor()
  await kitchen.screenshot({ path: `${SHOTS}/4-cocina-lista.png` })
  step('cocina: Empezar → Marcar lista')

  const alerts = waiter.getByRole('complementary', { name: 'Avisos' })
  await alerts.locator('div').filter({ hasText: 'Lista' }).filter({ hasText: TABLE })
    .getByRole('button', { name: 'Marcar servida' }).click()
  await waiter.getByRole('button', { name: new RegExp(`^Mesa ${TABLE}, Orden servida`) }).waitFor()
  step('mesero marcó la orden servida')

  await diner.getByRole('button', { name: 'Pedir la cuenta' }).click()
  await waiter.getByRole('button', { name: new RegExp(`^Mesa ${TABLE}, Cuenta solicitada`) }).waitFor({ timeout: 10_000 })
  await waiter.screenshot({ path: `${SHOTS}/5-mesero-cuenta.png` })
  step('comensal pidió la cuenta; el mesero la ve')

  await alerts.locator('div').filter({ hasText: 'Cuenta' }).filter({ hasText: TABLE })
    .getByRole('button', { name: 'Registrar cobro' }).click()
  const dialog = waiter.getByRole('dialog', { name: `Registrar cobro ${TABLE}` })
  await dialog.getByRole('button', { name: /^10%/ }).click()
  await dialog.getByRole('button', { name: 'Terminal' }).click()
  await waiter.screenshot({ path: `${SHOTS}/6-mesero-cobro.png` })
  await dialog.getByRole('button', { name: 'Registrar' }).click()
  await dialog.waitFor({ state: 'detached' })
  await waiter.getByRole('button', { name: new RegExp(`^Mesa ${TABLE}, Cerrada`) }).waitFor({ timeout: 10_000 })
  step('mesero registró el cobro total con 10% de propina; mesa cerrada')

  await diner.getByText('¡Gracias por tu visita!').waitFor({ timeout: 10_000 })
  await diner.screenshot({ path: `${SHOTS}/7-comensal-gracias.png` })
  step('el comensal ve "Gracias"')

  const admin = await staffPage(browser, 'admin@foody.local', { width: 1440, height: 900 }, '/admin')
  const salesHandle = await admin.waitForFunction(() => {
    const value = [...document.querySelectorAll('span')].find((s) => s.textContent === 'Ventas')?.nextElementSibling?.textContent
    return value && value !== '$0.00' ? value : null
  }, null, { timeout: 10_000 })
  await admin.screenshot({ path: `${SHOTS}/8-admin-dashboard.png` })
  step(`el dashboard muestra la venta: ${await salesHandle.jsonValue()}`)

  if (errors.length) throw new Error(`errores en la página: ${errors.join('; ')}`)
  console.log('E2E OK')
} catch (err) {
  for (const [name, page] of Object.entries(pages)) {
    await page.screenshot({ path: `${SHOTS}/fallo-${name.split('@')[0]}.png` }).catch(() => undefined)
  }
  console.log(`capturas del fallo en ${SHOTS}/fallo-*.png`)
  throw err
} finally {
  await browser.close()
}
