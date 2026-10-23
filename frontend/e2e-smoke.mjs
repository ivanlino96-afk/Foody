// Diner smoke test against the real local stack (Supabase + uvicorn + vite dev).
// Usage: node e2e-smoke.mjs   (env: APP_URL, API_URL, JWT_SECRET, CHROMIUM)
import { createHmac } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { chromium } from 'playwright-core'

const APP = process.env.APP_URL ?? 'http://127.0.0.1:5173'
const API = process.env.API_URL ?? 'http://127.0.0.1:8000/api/v1'
const SECRET = process.env.JWT_SECRET ?? 'super-secret-jwt-token-with-at-least-32-characters-long'
const WAITER_ID = '33333333-3333-3333-3333-333333333333'
const QR = 'dev-qr-m1-000000000000000000000000'
const SHOTS = 'smoke-shots'

const b64 = (obj) => Buffer.from(JSON.stringify(obj)).toString('base64url')
function staffToken(sub) {
  const head = b64({ alg: 'HS256', typ: 'JWT' })
  const body = b64({ sub, aud: 'authenticated', role: 'authenticated', exp: Math.floor(Date.now() / 1000) + 3600 })
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url')
  return `${head}.${body}.${sig}`
}

async function api(path, init = {}) {
  const res = await fetch(API + path, { ...init, headers: { 'Content-Type': 'application/json',
    Authorization: `Bearer ${staffToken(WAITER_ID)}`, ...init.headers } })
  if (!res.ok && res.status !== 409) throw new Error(`${path} → ${res.status} ${await res.text()}`)
  return res.status === 204 ? null : res.json()
}

async function openM1() {
  const m1 = (await api('/waiter/tables')).find((t) => t.code === 'M1')
  if (m1.status === 'closed') await api(`/waiter/tables/${m1.id}/release`, { method: 'POST' })
  if (['free', 'closed'].includes(m1.status)) await api(`/waiter/tables/${m1.id}/open`, { method: 'POST', body: '{}' })
}

const step = (msg) => console.log(`• ${msg}`)

mkdirSync(SHOTS, { recursive: true })
await openM1()
step('mesa M1 abierta por el mesero')

const browser = await chromium.launch({ executablePath: process.env.CHROMIUM ?? '/opt/pw-browsers/chromium' })
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 })
const errors = []
page.on('pageerror', (e) => errors.push(e.message))
try {
  await page.goto(`${APP}/mesa/${QR}`)
  await page.getByText('Preparando tu menú').waitFor()
  await page.screenshot({ path: `${SHOTS}/0-splash.png` })
  await page.getByRole('button', { name: 'Saltar' }).click()
  const add = page.getByRole('link', { name: /^Agregar / }).first()
  await add.waitFor()
  await page.screenshot({ path: `${SHOTS}/1-menu.png` })
  step('menú visible')

  await add.click()
  await page.getByRole('heading', { level: 1 }).waitFor()
  const dish = await page.getByRole('heading', { level: 1 }).textContent()
  const extra = page.getByRole('button', { name: /^Agregar (?!$)/ }).first()
  if (await extra.count()) await extra.click()
  await page.getByLabel('Nota para cocina').fill('sin picante')
  await page.screenshot({ path: `${SHOTS}/2-detalle.png`, fullPage: true })
  await page.getByRole('button', { name: /^Agregar\$|^Agregar \$|^Agregar/ }).last().click()
  step(`agregado: ${dish}`)

  await page.getByRole('link', { name: /ver pedido/i }).click()
  await page.getByRole('heading', { name: 'Tu pedido' }).waitFor()
  await page.screenshot({ path: `${SHOTS}/3-carrito.png`, fullPage: true })
  await page.getByRole('button', { name: /enviar a cocina/i }).click()

  await page.getByRole('heading', { name: 'Tu cuenta' }).waitFor()
  await page.getByText('Recibida').first().waitFor()
  await page.screenshot({ path: `${SHOTS}/4-cuenta.png`, fullPage: true })
  step('orden enviada; la cuenta muestra "Recibida"')

  const kitchen = await api('/kitchen/orders', { headers: { Authorization: `Bearer ${staffToken('22222222-2222-2222-2222-222222222222')}` } })
  if (!kitchen.some((o) => o.table_code === 'M1' && o.lines.some((l) => l.item_name === dish))) {
    throw new Error('la orden no apareció en cocina')
  }
  step('la orden aparece en cocina')
  if (errors.length) throw new Error(`errores en la página: ${errors.join('; ')}`)
  console.log('SMOKE OK')
} finally {
  await browser.close()
}
