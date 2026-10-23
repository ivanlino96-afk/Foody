# Foody — Frontend base + comensal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La app React del comensal en `/mesa/:token`: splash, menú con disponibilidad, detalle con personalización, carrito que envía a cocina, estado de las rondas y pedir la cuenta o llamar al mesero.

**Architecture:** Vite + React + TypeScript + Tailwind en `frontend/`, MVVM: las Views solo pintan lo que da su ViewModel (`use*ViewModel.ts`); los ViewModels usan repositorios de `data/` y reglas puras de `domain/`. El frontend replica el precio solo como vista previa; el backend manda (`expected_total_cents` → `price_changed`).

**Tech Stack:** Node 22, Vite 6, React 19, React Router 7, Tailwind 4 (`@tailwindcss/vite`), Vitest 3 + Testing Library + jsdom, ESLint 9 (typescript-eslint).

**Spec:** `docs/superpowers/specs/2026-10-21-foody-design-v1.md` (secciones Arquitectura/frontend, Disponibilidad, Flujos, API, Errores). Diseño: artboards `B-Splash`, `B-SplashBowl`, `B-Menu`, `B-Detalle`, `B-Carrito`, `B-Pago` de https://claude.ai/artifact/EG1Vhx3aFt7yuU8iZ2Acd1.

## Global Constraints

- Paleta Bosque: bosque `#2F4A3A`, hoja `#E4ECE6`, madera `#A8784C`, avena `#F4F1EA`, carbón `#1B1E1B`, musgo `#5A615B`, línea `#E3DED3`; tipografía Plus Jakarta Sans 400–800.
- Mobile-first (390 px de referencia), objetivos táctiles ≥ 44 px, sin emoji; íconos SVG de trazo en línea.
- Montos en centavos enteros MXN; formato `$1,234.50` con `Intl.NumberFormat('es-MX', {style:'currency', currency:'MXN'})`.
- El comensal no inicia sesión; todas sus llamadas van a `/api/v1/diner/tables/{token}`.
- Menú se vuelve a pedir cada 30 s y al abrir el carrito; sesión/estado cada 5 s.
- Mercado Pago queda fuera (Plan 5): la cuenta se paga con el mesero.
- Textos en español de México.

## Review Focus

1. **QR inválido o mesa borrada** (404): pantalla "Este QR no es válido" sin reintentos infinitos. Prueba: Task 3 `shows invalid qr screen on 404`.
2. **Mesa Libre o Cerrada**: se ve el menú, el botón de enviar queda deshabilitado con "Pide al mesero que abra tu mesa"; al abrirse, se habilita en la siguiente consulta. Prueba: Task 4 `send is disabled until the table can order`.
3. **Doble toque en "Enviar a cocina" o red lenta**: una sola orden (misma `idempotency_key` mientras el carrito no cambie). Prueba: Task 4 `retry reuses the idempotency key`.
4. **Algo del carrito se agota entre el menú y el envío**: `item_unavailable` marca esas líneas, el botón pide quitarlas. Prueba: Task 4 `item_unavailable marks lines and blocks send`.
5. **Recargar la página a medio pedido**: el carrito sobrevive (sessionStorage por token) y se descartan líneas de platillos que ya no existen. Prueba: Task 2 `cart store drops lines for unknown items`.

---

### Task 1: Proyecto, tokens y dominio del carrito

**Files:**
- Create: `frontend/package.json`, `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/index.html`, `frontend/eslint.config.js`, `frontend/src/main.tsx`, `frontend/src/index.css`, `frontend/src/test/setup.ts`, `frontend/src/domain/types.ts`, `frontend/src/domain/money.ts`, `frontend/src/domain/cart.ts`
- Test: `frontend/src/domain/cart.test.ts`, `frontend/src/domain/money.test.ts`

**Interfaces:**
- Produces:
  - `types.ts`: tipos del API tal como los da FastAPI (`DinerTable`, `MenuCategory`, `MenuItem`, `MenuIngredient`, `MenuExtra`, `DinerSession`, `DinerRound`, `OrderLine`, `OrderStatus`, `TableStatus`, `ServiceCallType`, `PlacedOrder`).
  - `formatMoney(cents: number): string`.
  - `CartLine = {key, menuItemId, quantity, removedIngredientIds: string[], extras: {extraId, quantity}[], note: string}`; `linePriceCents(line, item): number` (`(precio + Σ extra.precio·cant)·cantidad`); `cartTotalCents(lines, itemsById): number`; `lineKey(line)` determinista (ids ordenados + nota) y `addLine(lines, line)` que suma cantidades si la llave coincide; `toOrderLines(lines)` → cuerpo de `POST /orders` (`menu_item_id`, `quantity`, `removed_ingredient_ids`, `extras[{extra_id, quantity}]`, `note` o `null`).
  - Tailwind 4 `@theme` con colores `bosque`, `hoja`, `madera`, `avena`, `carbon`, `musgo`, `linea` y `--font-sans: "Plus Jakarta Sans"`.
  - Vite proxy `/api` → `http://127.0.0.1:8000`; `VITE_SUPABASE_URL` para fotos.

- [ ] **Step 1: Write failing tests**: `formatMoney(38500) === "$385.00"`, `formatMoney(123450) === "$1,234.50"`; `linePriceCents` con precio 9500, extra 1500×2 y cantidad 2 = 25000; `addLine` dos veces la misma personalización deja una línea con cantidad 2, y con nota distinta deja dos; `toOrderLines` manda `note: null` para nota vacía o solo espacios.
- [ ] **Step 2: Run** `npm test -- --run` → FAIL (módulos no existen).
- [ ] **Step 3: Implement** scaffolding, tokens y `domain/`.
- [ ] **Step 4: Run** `npm test -- --run`, `npm run lint`, `npm run build` → verdes.
- [ ] **Step 5: Commit** `feat(frontend): vite app, Bosque tokens and cart domain`

### Task 2: Cliente HTTP, API del comensal y carrito persistente

**Files:**
- Create: `frontend/src/data/api/http.ts`, `frontend/src/data/api/dinerApi.ts`, `frontend/src/data/repositories/cartStore.ts`, `frontend/src/data/photos.ts`
- Test: `frontend/src/data/api/http.test.ts`, `frontend/src/data/repositories/cartStore.test.ts`

**Interfaces:**
- Produces:
  - `class ApiError extends Error {status: number; code: string; details: Record<string, unknown>}`; `request<T>(path, init?) : Promise<T>` sobre `fetch('/api/v1' + path)`; respuesta no-OK con cuerpo `{code,message,details}` → `ApiError`; sin cuerpo JSON → `code: "network"` o `"http_<status>"`; 204 → `undefined`.
  - `dinerApi(token)` → `{getTable(), getMenu(), getSession(), placeOrder(body), callService(type)}` con el token codificado con `encodeURIComponent`.
  - `photoUrl(path: string | null): string | null` → `${VITE_SUPABASE_URL}/storage/v1/object/public/menu-photos/${path}`.
  - `loadCart(token, knownItemIds?: Set<string>): CartLine[]`, `saveCart(token, lines)`, `clearCart(token)` sobre `sessionStorage` con llave `foody.cart.<token>`, tolerante a JSON roto o storage que lanza.

- [ ] **Step 1: Write failing tests**: `request` convierte 409 `{code:"item_unavailable",details:{lines:[...]}}` en `ApiError` con esos campos; fallo de `fetch` → `code "network"`; `cart store drops lines for unknown items`; JSON roto → `[]`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** tests + lint → PASS.
- [ ] **Step 5: Commit** `feat(frontend): diner api client and persistent cart`

### Task 3: Splash y menú

**Files:**
- Create: `frontend/src/shared/usePolling.ts`, `frontend/src/shared/ui/` (`Button.tsx`, `IconButton.tsx`, `Badge.tsx`, `icons.tsx`), `frontend/src/app/App.tsx`, `frontend/src/app/routes.tsx`, `frontend/src/features/diner/DinerContext.tsx`, `frontend/src/features/diner/viewmodels/useMenuViewModel.ts`, `frontend/src/features/diner/views/SplashView.tsx`, `frontend/src/features/diner/views/MenuView.tsx`, `frontend/src/features/diner/views/InvalidQrView.tsx`
- Test: `frontend/src/features/diner/viewmodels/useMenuViewModel.test.tsx`, `frontend/src/features/diner/views/MenuView.test.tsx`

**Interfaces:**
- Produces:
  - `usePolling(fn, intervalMs, deps)`: llama al montar y cada `intervalMs`, pausa con `document.hidden`, no encima llamadas.
  - `DinerProvider({token})` y `useDiner()` → `{token, api, table, session, refreshSession, cart, setCart}`; tabla y sesión se consultan cada 5 s.
  - `useMenuViewModel()` → `{status: 'loading'|'ready'|'invalid_qr'|'error', categories, activeCategoryId, setActiveCategory, query, setQuery, visibleItems, cartCount, cartTotalCents, refresh}`; menú cada 30 s; `visibleItems` filtra por categoría y por texto (sin acentos, minúsculas).
  - Rutas: `/mesa/:token` (menú), `/mesa/:token/platillo/:itemId`, `/mesa/:token/pedido`, `/mesa/:token/cuenta`; `*` → pantalla neutra de Foody.
  - Splash `B-Splash` (sándwich) la primera vez por pestaña (`sessionStorage foody.splash.<token>`), 1.8 s o hasta que cargue el menú (lo que tarde más, máximo 4 s), con "Saltar"; respeta `prefers-reduced-motion`.

- [ ] **Step 1: Write failing tests**: `shows invalid qr screen on 404`; `filters by category and accent-insensitive search` ("enchilada" encuentra "Enchiladas"; "sopa" con categoría Tacos no encuentra nada); `refreshes the menu every 30 s` (fake timers: 2 llamadas tras 30 s); `MenuView` pinta "No disponible" y sin botón Agregar para un platillo agotado, y el pie "Ver pedido" con conteo y total.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** según `B-Menu` y `B-Splash`. **Step 4: Run** → PASS + lint.
- [ ] **Step 5: Commit** `feat(diner): splash and menu`

### Task 4: Detalle del platillo y carrito

**Files:**
- Create: `frontend/src/features/diner/viewmodels/useDishDetailViewModel.ts`, `frontend/src/features/diner/viewmodels/useCartViewModel.ts`, `frontend/src/features/diner/views/DishDetailView.tsx`, `frontend/src/features/diner/views/CartView.tsx`
- Test: `frontend/src/features/diner/viewmodels/useDishDetailViewModel.test.tsx`, `frontend/src/features/diner/viewmodels/useCartViewModel.test.tsx`

**Interfaces:**
- Consumes: `addLine`, `linePriceCents`, `cartTotalCents`, `toOrderLines` (Task 1); `dinerApi`, `ApiError`, `saveCart` (Task 2); `useDiner` (Task 3).
- Produces:
  - `useDishDetailViewModel(itemId)` → `{item, quantity, inc, dec, removed: Set, toggleIngredient(id), extraQty(id), incExtra(id), decExtra(id), note, setNote, previewCents, canAdd, add()}`; solo ingredientes `is_removable` y disponibles se pueden quitar; extras entre 0 y `max_quantity`; cantidad 1–50; nota ≤ 200.
  - `useCartViewModel()` → `{lines: CartLineView[], roundCents, previousRoundsCents, tableCents, canSend, blockReason, sending, send(), remove(key), changeQty(key, n), priceChangedTo: number|null}`; `send` usa una `idempotency_key` (`crypto.randomUUID()`) que se conserva hasta que el carrito cambia o la orden entra; manda `expected_total_cents`; al éxito limpia el carrito, refresca la sesión y navega a `/cuenta`; `item_unavailable` marca las líneas de `details.lines[].menu_item_id`; `price_changed` guarda `details.total_cents` y el siguiente `send` lo confirma; `table_not_open` → `blockReason`.

- [ ] **Step 1: Write failing tests**: `essential ingredients cannot be removed`; `extras are capped at max_quantity`; `preview matches line price`; `send is disabled until the table can order`; `retry reuses the idempotency key` (primer intento falla con `network`, el segundo manda la misma llave); `item_unavailable marks lines and blocks send`; `price_changed asks to confirm the new total`; `successful send clears the cart`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** según `B-Detalle` y `B-Carrito`. **Step 4: Run** → PASS + lint.
- [ ] **Step 5: Commit** `feat(diner): dish customization and cart`

### Task 5: Estado de la orden, cuenta y avisos

**Files:**
- Create: `frontend/src/features/diner/viewmodels/useAccountViewModel.ts`, `frontend/src/features/diner/views/AccountView.tsx`, `frontend/src/features/diner/views/RoundBanner.tsx`
- Test: `frontend/src/features/diner/viewmodels/useAccountViewModel.test.tsx`

**Interfaces:**
- Consumes: `useDiner` (Task 3), `dinerApi.callService` (Task 2).
- Produces:
  - `useAccountViewModel()` → `{rounds: RoundView[] (número, estado en español, líneas, total), subtotalCents, paidCents, balanceCents, billRequested, waiterCalled, requestBill(), callWaiter(), busy, closed}`. Estados: received "Recibida", preparing "Preparando", ready "Lista", served "Servida", cancelled "Cancelada".
  - `RoundBanner` en el menú: la ronda más reciente no servida con su estado (`B-Menu`), enlace "Ver" a `/cuenta`.
  - Botones de campana y ticket del encabezado del menú llaman `callWaiter` / `requestBill`; muestran "Avisamos al mesero" mientras haya aviso pendiente.

- [ ] **Step 1: Write failing tests**: `maps round statuses to spanish labels`; `request bill marks billRequested after refresh`; `call waiter twice sends one request while pending`; `shows thank-you when session is paid` (sesión `null` tras haber tenido rondas → `closed`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** según `B-Pago` sin Mercado Pago: desglose de rondas, subtotal, pagado y saldo, "Pedir la cuenta" y la leyenda "Paga con el mesero en efectivo o tarjeta". **Step 4: Run** → PASS + lint.
- [ ] **Step 5: Commit** `feat(diner): order status, bill request and waiter call`

### Task 6: Prueba de humo contra el backend y documentación

**Files:**
- Create: `frontend/README.md`, `frontend/.env.example`, `frontend/e2e-smoke.mjs` (script de Playwright sin runner)
- Modify: `README.md` raíz (cómo levantar backend + frontend)

- [ ] **Step 1:** Con Supabase local, `uvicorn` y `npm run dev`, el script abre `/mesa/dev-qr-m1-000000000000000000000000` a 390×844, salta el splash, agrega un platillo, envía con la mesa abierta por API como mesero, y verifica que la cuenta muestra "Recibida". Guarda capturas del menú, detalle, carrito y cuenta.
- [ ] **Step 2: Run** el script → PASS; `npm test -- --run`, `npm run lint`, `npm run build` verdes.
- [ ] **Step 3: Commit** `docs(frontend): run instructions and diner smoke script`

---

## Self-review

- **Cobertura de la spec del comensal:** QR/mesa (3), menú con disponibilidad y consulta cada 30 s (3), personalización y total de vista previa (1, 4), envío con idempotencia y errores `item_unavailable`/`price_changed`/`table_not_open` (4), estado de rondas cada 5 s (3, 5), llamar mesero y pedir cuenta (5). Fuera: pago en la app (Plan 5); pantallas del personal (Plan 4).
- **Tipos:** `CartLine`, `dinerApi`, `useDiner` se usan con los mismos nombres en Tasks 1–5.
