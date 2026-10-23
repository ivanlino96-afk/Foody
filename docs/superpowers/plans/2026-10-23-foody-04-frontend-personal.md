# Foody — Frontend del personal + E2E Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Las pantallas de cocina, mesero y administrador sobre el backend de los Planes 1–2, con login de Supabase Auth, actualización en tiempo real y una prueba E2E de punta a punta.

**Architecture:** Misma app React del Plan 3 (`frontend/`), MVVM. El personal entra con `@supabase/supabase-js` (email y contraseña); el JWT viaja como `Bearer` a FastAPI, que decide el rol. Realtime de Supabase (`postgres_changes` sobre `orders`, `dining_tables`, `service_calls`, `payments`, ya publicadas) solo dispara un refetch por la API; siempre hay polling de respaldo. Tablet/PC primero (1280 px), utilizable desde 768 px.

**Tech Stack:** Lo del Plan 3 + `@supabase/supabase-js` 2, `playwright-core` (Chromium preinstalado) para E2E.

**Spec:** `docs/superpowers/specs/2026-10-21-foody-design-v1.md` (Roles, Disponibilidad, Estados, Flujos, API, Dashboard, Realtime). Diseño: `B-Cocina`, `B-Disponibilidad`, `B-Mesero`, `B-Admin` de https://claude.ai/artifact/EG1Vhx3aFt7yuU8iZ2Acd1.

## Global Constraints

- Paleta y tipografía del Plan 3; encabezado blanco con marca `foody.` y chip negro del rol (`COCINA`, `MESERO`).
- Rutas: `/login`, `/cocina`, `/cocina/disponibilidad`, `/mesero`, `/admin` (+ subrutas). Admin puede entrar a todas.
- Cocina recibe una orden nueva en < 2 s (Realtime) y suena un aviso; respaldo por polling cada 10 s (cocina), 5 s (mesero), 30 s (dashboard).
- Una orden es "tarde" cuando lleva más de 15 min sin estar lista (encabezado rojo).
- Estados de mesa en español con los colores de `B-Mesero`: Libre `#CFC8BA`, Ocupada `#5B7FA6`, En espera de orden `#B98552`, Orden servida `#5E8C6A`, Cuenta solicitada `#E11D48`, Cerrada `#77736A`.
- La service role de Supabase nunca llega al navegador; el frontend solo usa la anon key.
- Mercado Pago sigue fuera.

## Review Focus

1. **Sesión vencida o usuario desactivado a media jornada**: 401/403 de la API → regresa a `/login` con aviso, sin pantallas en blanco. Prueba: Task 2 `401 from the api signs out and redirects`.
2. **Realtime caído** (sin red o websocket cerrado): el tablero sigue por polling y muestra "Reconectando". Prueba: Task 3 `falls back to polling when realtime is down`.
3. **Dos personas tocan la misma acción** (dos cocineros "Empezar", dos meseros cobran): el 409 se muestra como aviso y la vista se refresca, sin duplicar. Prueba: Task 3 `conflict refreshes instead of failing`, Task 4 `payment over balance shows the error`.
4. **Cobro con monto mayor al saldo o con decimales mal escritos**: el formulario valida antes de enviar y acepta "640", "640.5", "$640.50". Prueba: Task 4 `parses money input`.
5. **Admin borra o desactiva algo en uso**: mesa ocupada no se puede borrar (409 con mensaje); desactivarse a sí mismo muestra el error del backend. Prueba: Task 7 `cannot delete a busy table`.

---

### Task 1: Backend — perfil del personal y órdenes listas para el mesero

**Files:**
- Modify: `backend/app/presentation/routers/staff.py` (create), `backend/app/main.py`, `backend/app/presentation/routers/kitchen.py`
- Test: `backend/tests/api/test_me_api.py`

**Interfaces:**
- Produces: `GET /api/v1/me` → `{id, full_name, role}` para cualquier personal activo (401 sin token, 403 inactivo). `GET /kitchen/orders` también para meseros (solo lectura; cambiar estado sigue siendo cocina/admin).

- [ ] **Step 1: Write failing tests** `test_me_returns_role`, `test_me_requires_token`, `test_waiter_can_read_kitchen_orders`, `test_waiter_cannot_change_kitchen_status`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** `uv run pytest -q` + ruff → PASS.
- [ ] **Step 5: Commit** `feat(api): staff profile endpoint and waiter read access to ready orders`

### Task 2: Login, sesión y guardias por rol

**Files:**
- Create: `frontend/src/data/supabase.ts`, `frontend/src/data/api/staffApi.ts`, `frontend/src/features/auth/AuthContext.tsx`, `frontend/src/features/auth/viewmodels/useLoginViewModel.ts`, `frontend/src/features/auth/views/LoginView.tsx`, `frontend/src/features/auth/RequireRole.tsx`, `frontend/src/shared/ui/StaffHeader.tsx`
- Modify: `frontend/src/data/api/http.ts` (token opcional), `frontend/src/app/routes.tsx`, `frontend/.env.example` (`VITE_SUPABASE_ANON_KEY`)
- Test: `frontend/src/features/auth/AuthContext.test.tsx`, `frontend/src/features/auth/viewmodels/useLoginViewModel.test.tsx`

**Interfaces:**
- Produces:
  - `AuthProvider({client?})`, `useAuth()` → `{status: 'loading'|'signed_out'|'signed_in', staff: {id, full_name, role} | null, token, signIn(email, pw), signOut(), notice}`; carga `/me` tras iniciar sesión; 401/403 de cualquier llamada del personal → `signOut()` con `notice`.
  - `staffApi(getToken, onUnauthorized)` con métodos tipados para cocina, mesero, disponibilidad y admin (los que usan Tasks 3–7).
  - `RequireRole({roles, children})`: sin sesión → `/login?next=`; rol no permitido → su pantalla de inicio. Inicio por rol: cocina → `/cocina`, mesero → `/mesero`, admin → `/admin`.
- [ ] **Step 1: Write failing tests**: `signs in and loads the staff profile`; `401 from the api signs out and redirects`; `wrong password shows the message` ("Correo o contraseña incorrectos"); `redirects each role to its home`.
- [ ] **Step 2–4:** FAIL → implementar (login con el estilo Bosque) → PASS + lint + build.
- [ ] **Step 5: Commit** `feat(staff): supabase login, session and role guards`

### Task 3: Cocina y disponibilidad

**Files:**
- Create: `frontend/src/data/realtime.ts`, `frontend/src/features/kitchen/viewmodels/useKitchenBoardViewModel.ts`, `frontend/src/features/kitchen/views/KitchenBoardView.tsx`, `frontend/src/features/availability/viewmodels/useAvailabilityViewModel.ts`, `frontend/src/features/availability/views/AvailabilityView.tsx`, `frontend/src/shared/sound.ts`
- Test: `frontend/src/features/kitchen/viewmodels/useKitchenBoardViewModel.test.tsx`, `frontend/src/features/availability/viewmodels/useAvailabilityViewModel.test.tsx`

**Interfaces:**
- Produces:
  - `useLiveRefresh(tables: string[], refresh, fallbackMs)` → `{connected: boolean}`; suscripción a `postgres_changes` con el cliente autenticado, refetch con debounce de 300 ms, polling de respaldo siempre activo.
  - `useKitchenBoardViewModel()` → `{columns: [{status, title, tickets}], activeCount, avgPrepMinutes, connected, start(id), markReady(id), busyId, notice}`; tickets con `elapsed` (mm:ss, se actualiza cada segundo), `late`, modificaciones "Sin x" / "+ x" y nota; nueva orden `received` no vista → `playChime()`.
  - `useAvailabilityViewModel()` → `{tab, setTab, query, setQuery, rows, offCount, toggle(row)}` con cambio optimista y reversión si falla.
- [ ] **Step 1: Write failing tests**: `groups orders into three columns`; `marks orders late after 15 minutes`; `plays a chime for a new received order once`; `conflict refreshes instead of failing`; `falls back to polling when realtime is down`; `toggle is optimistic and reverts on error`.
- [ ] **Step 2–4:** FAIL → implementar según `B-Cocina` y `B-Disponibilidad` → PASS.
- [ ] **Step 5: Commit** `feat(kitchen): live kitchen board and availability`

### Task 4: Mesero

**Files:**
- Create: `frontend/src/features/waiter/viewmodels/useTablesMapViewModel.ts`, `frontend/src/features/waiter/viewmodels/useServiceCallsViewModel.ts`, `frontend/src/features/waiter/viewmodels/usePaymentViewModel.ts`, `frontend/src/features/waiter/views/WaiterView.tsx`, `frontend/src/features/waiter/views/TableSheet.tsx`, `frontend/src/features/waiter/views/PaymentDialog.tsx`, `frontend/src/domain/moneyInput.ts`
- Test: `frontend/src/features/waiter/viewmodels/*.test.tsx`, `frontend/src/domain/moneyInput.test.ts`

**Interfaces:**
- Produces:
  - `parseMoneyInput(text): number | null` (centavos; acepta `640`, `640.5`, `$1,640.50`; rechaza negativos y más de 2 decimales).
  - `useTablesMapViewModel()` → `{tables (con label, color, detalle: "Toca para abrir", "#016 preparando · 6 min", "Saldo $640"), occupiedLine, legend, selected, select(id), open(guests?), reopen(), release(), requestBill()}`.
  - `useServiceCallsViewModel()` → `{alerts}`: órdenes `ready` (acción "Marcar servida"), llamadas (acción "Atender") y cuentas pedidas (acción "Registrar cobro"), más recientes primero.
  - `usePaymentViewModel(table)` → `{balanceCents, method, setMethod, amountText, tipText, tipPresets (10/15/20 % del saldo), error, submit()}`; valida monto ≤ saldo y > 0.
- [ ] **Step 1: Write failing tests**: `parses money input`; `table details follow status`; `alerts combine ready orders, calls and bills`; `payment over balance shows the error`; `full payment closes the dialog and refreshes`.
- [ ] **Step 2–4:** FAIL → implementar según `B-Mesero` (mapa 4 columnas + panel de avisos; hoja lateral por mesa) → PASS.
- [ ] **Step 5: Commit** `feat(waiter): tables map, alerts and manual payments`

### Task 5: Admin — shell, dashboard e historial

**Files:**
- Create: `frontend/src/features/admin/AdminLayout.tsx`, `frontend/src/features/admin/viewmodels/useDashboardViewModel.ts`, `frontend/src/features/admin/views/DashboardView.tsx`, `frontend/src/features/admin/viewmodels/useOrdersViewModel.ts`, `frontend/src/features/admin/views/OrdersView.tsx`
- Test: `frontend/src/features/admin/viewmodels/useDashboardViewModel.test.tsx`, `useOrdersViewModel.test.tsx`

**Interfaces:**
- Produces:
  - Barra lateral de `B-Admin`: Dashboard, Órdenes, Menú, Ingredientes y extras, Disponibilidad, Mesas y QR, Personal, Configuración.
  - `useDashboardViewModel()` → `{date, setDate, kpis (Ventas, Ganancia+margen, Propinas, Órdenes+canceladas, Ticket promedio, Mesas ocupadas), bars (solo horas con ventas o entre la primera y la última), now (Recibidas, Preparando, Listas, Cuentas pendientes), live}`; en vivo solo cuando la fecha es hoy.
  - `useOrdersViewModel()` → filtros `from`, `to`, `status`, `table`; filas con hora local, estado en español y total.
- [ ] **Step 1: Write failing tests**: `builds kpis from the dashboard`; `bars span the busy hours`; `live only for today`; `orders filters go to the query`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `feat(admin): dashboard and orders history`

### Task 6: Admin — menú, ingredientes y extras

**Files:**
- Create: `frontend/src/features/admin/viewmodels/useCatalogViewModel.ts`, `frontend/src/features/admin/viewmodels/useDishFormViewModel.ts`, `frontend/src/features/admin/views/MenuAdminView.tsx`, `frontend/src/features/admin/views/DishForm.tsx`, `frontend/src/features/admin/views/IngredientsExtrasView.tsx`
- Test: `frontend/src/features/admin/viewmodels/useDishFormViewModel.test.tsx`, `useCatalogViewModel.test.tsx`

**Interfaces:**
- Produces: `useCatalogViewModel(kind)` (lista, crear, editar, borrar con confirmación); `useDishFormViewModel(dish?)` → campos con precios en texto (`parseMoneyInput`), ligas de ingredientes (removible sí/no) y extras (máximo), `uploadPhoto(file)` (jpeg/png/webp ≤ 5 MB validado antes de subir), `save()` que manda solo lo cambiado en edición.
- [ ] **Step 1: Write failing tests**: `new dish sends links and cents`; `edit sends only changed fields`; `rejects photos over 5 MB or wrong type`; `delete asks for confirmation`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `feat(admin): menu, ingredients and extras management`

### Task 7: Admin — mesas y QR, personal y configuración

**Files:**
- Create: `frontend/src/features/admin/viewmodels/useTablesAdminViewModel.ts`, `useStaffViewModel.ts`, `useSettingsViewModel.ts`, `frontend/src/features/admin/views/TablesAdminView.tsx`, `StaffView.tsx`, `SettingsView.tsx`
- Test: `frontend/src/features/admin/viewmodels/useTablesAdminViewModel.test.tsx`, `useStaffViewModel.test.tsx`, `useSettingsViewModel.test.tsx`

**Interfaces:**
- Produces: mesas con QR (imagen de `/admin/tables/{id}/qr.png` pedida con token y mostrada como blob; botón Imprimir abre una hoja con el QR, código y URL), regenerar con confirmación; personal (crear con correo/contraseña ≥ 8/rol, editar nombre/rol/activo); configuración (nombre, minutos de liberación 0–240, propinas 1–5 valores 1–100).
- [ ] **Step 1: Write failing tests**: `cannot delete a busy table` (muestra el mensaje del 409); `regenerate asks first`; `staff form validates password length`; `settings validates tip options`.
- [ ] **Step 2–4:** FAIL → implementar → PASS.
- [ ] **Step 5: Commit** `feat(admin): tables and QR, staff and settings`

### Task 8: E2E de punta a punta

**Files:**
- Create: `frontend/e2e/flow.mjs`, `frontend/e2e/README.md`
- Modify: `frontend/package.json` (`"e2e": "node e2e/flow.mjs"`), `README.md`

- [ ] **Step 1:** Supabase local con Auth, Realtime, Storage y gateway (`supabase start` sin excluir `kong`, `gotrue`, `realtime`, `storage-api`, `postgrest`), backend con `SUPABASE_SERVICE_ROLE_KEY` de `supabase status`, Vite.
- [ ] **Step 2:** El script, con tres contextos de navegador (cocina en 1280×800, mesero en 1280×800, comensal en 390×844), recorre: mesero inicia sesión y abre M2 → comensal ordena → la orden aparece en cocina sin recargar (< 3 s) → cocina Empezar y Marcar lista → mesero Marcar servida → comensal Pedir la cuenta → mesero Registrar cobro total con propina → comensal ve "Gracias" → admin inicia sesión y el dashboard muestra la venta. Guarda capturas de cada pantalla en `smoke-shots/e2e/`.
- [ ] **Step 3: Run** `npm run e2e` → PASS; `npx vitest --run`, lint, build y `uv run pytest -q` verdes.
- [ ] **Step 4: Commit** `test(e2e): end-to-end service flow`

---

## Self-review

- **Cobertura:** login y roles (2), cocina con tiempo real y sonido (3), disponibilidad de hoy (3), mapa de mesas, avisos y cobro (4), dashboard en vivo e historial (5), CRUD de menú con fotos (6), mesas/QR, personal, configuración (7), E2E (8). Backend faltante para el frontend: perfil y lectura de órdenes listas (1).
- **Tipos:** `staffApi`, `useAuth`, `useLiveRefresh`, `parseMoneyInput` se definen en 2–4 y se reutilizan en 5–8.
