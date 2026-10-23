# Foody Plan 2: Cuenta y administración (backend)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cerrar el ciclo de la mesa sin pago en línea (pedir cuenta, llamar mesero, cobro manual, cierre) y dar al admin todo el backend que necesita: catálogo con fotos, disponibilidad con log, mesas con QR, personal, historial de órdenes, dashboard y configuración.

**Architecture:** Sigue la Clean Architecture del Plan 1. Lo que tiene reglas (avisos, cobro, disponibilidad) pasa por dominio y casos de uso probados con `InMemoryUnitOfWork`. El CRUD de administración casi no tiene reglas: sus casos de uso hablan con puertos nuevos (`CatalogRepository`, `AdminTableRepository`, `StaffAdminRepository`, `ReportRepository`, `PhotoStorage`, `AuthAdmin`) que solo tienen implementación SQL o HTTP, y se prueban con pruebas de API marcadas `integration` contra Supabase local.

**Tech Stack:** FastAPI, SQLAlchemy 2 Core + psycopg 3, Supabase (Postgres, Auth admin API, Storage), `segno` para el PNG del QR, `httpx` para Storage y Auth admin.

**Spec:** `docs/superpowers/specs/2026-10-21-foody-design-v1.md` (copia de la [spec aprobada](https://claude.ai/artifact/XF2pj8rMVHXiPMSSeUWYmy)). Mercado Pago (`start_checkout`, `confirm_payment`, webhook) queda fuera por decisión de Ivan del 2026-10-23; va en el Plan 5.

## Global Constraints

- Montos en centavos MXN (`int`); días de negocio en `America/Mexico_City`.
- Rutas bajo `/api/v1`; errores `{"code","message","details"}`; mismo mapeo de errores del Plan 1.
- El rol `admin` pasa toda guardia de rol (`require_roles`).
- Toda escritura de catálogo pone `updated_by`/`created_by` = staff que la hizo; los borrados son lógicos (`deleted_at`).
- Cada cambio de disponibilidad escribe una fila en `availability_log`.
- Secretos (service role) solo en variables de entorno del backend.
- `qr_token`: 32 caracteres de `[A-Za-z0-9_-]` (compatible con el patrón del router del comensal).

## Review Focus

1. **Dos pagos parciales que juntos cubren la cuenta** (dividir la cuenta). El segundo cierra la mesa; un pago que excede el saldo se rechaza con 422 sin escribir nada. Prueba: Task 3 `test_split_payment_closes_on_second` y `test_payment_over_balance_is_rejected`.
2. **El comensal toca "Pedir la cuenta" dos veces o desde dos celulares.** Un solo aviso pendiente y un solo cambio de estado. Prueba: Task 2 `test_request_bill_twice_keeps_one_call`.
3. **Extra o ingrediente borrado, o categoría oculta, que sigue en un carrito viejo.** `item_unavailable`, no se acepta. Prueba: Task 5 `test_deleted_extra_and_hidden_category_are_not_orderable`.
4. **Regenerar el QR de una mesa con comensales.** El QR viejo deja de funcionar (404) y la sesión abierta sigue intacta. Prueba: Task 7 `test_regenerate_qr_invalidates_old_token`.
5. **Cancelar una orden de una cuenta ya cerrada.** 409 `invalid_transition`, los totales no cambian. Prueba: Task 3 `test_cannot_cancel_after_session_closed`.

---

### Task 1: Entidades y reglas de cobro

**Files:**
- Modify: `backend/app/domain/entities.py`, `backend/app/domain/enums.py`
- Create: `backend/app/domain/services/billing.py`
- Test: `backend/tests/unit/test_billing.py`

**Interfaces:**
- Produces:
  - Enums `PaymentMethod(CASH="cash", CARD_TERMINAL="card_terminal", MERCADO_PAGO="mercado_pago")`, `PaymentStatus(PENDING, APPROVED, REJECTED, CANCELLED, REFUNDED)`, `ServiceCallType(CALL_WAITER="call_waiter", REQUEST_BILL="request_bill")`, `AvailabilityEntity(MENU_ITEM="menu_item", INGREDIENT="ingredient", EXTRA="extra")`.
  - `@dataclass Payment(id, session_id, method, status, amount_cents, tip_cents, received_by, paid_at, created_at)`.
  - `@dataclass ServiceCall(id, session_id, table_id, type, created_at, attended_at=None, attended_by=None)`.
  - `TableSession` gana `bill_requested_at: datetime | None = None` y `paid_at: datetime | None = None`.
  - `balance_cents(session) -> int` = `subtotal + tip − paid`.
  - `apply_payment(session, amount_cents, tip_cents) -> bool`: valida `amount_cents >= 1`, `tip_cents >= 0`, `amount_cents <= subtotal − (paid − tip)` (lo que falta sin propina); si no, `InvalidCustomization` con `details.field` = `amount_cents`/`tip_cents`. Suma `tip` a `tip_cents` y `amount + tip` a `paid_cents`; devuelve `True` si quedó saldada (`paid >= subtotal + tip`).

- [ ] **Step 1: Write the failing tests** en `tests/unit/test_billing.py`: `test_balance_counts_tip`, `test_apply_payment_settles_exact_amount` (subtotal 10000, pago 10000 + 1500 propina → True, paid 11500, tip 1500, balance 0), `test_partial_payment_does_not_settle` (6000 de 10000 → False, balance 4000), `test_amount_over_remaining_is_rejected` (10001 → `InvalidCustomization` `field=amount_cents`, sesión sin cambios), `test_zero_or_negative_amounts_are_rejected`.
- [ ] **Step 2: Run** `uv run pytest tests/unit/test_billing.py -q` → FAIL (import). **Step 3: Implement.** **Step 4: Run** → PASS y `uv run pytest -q` verde.
- [ ] **Step 5: Commit** `feat(domain): payments, service calls and billing rules`

---

### Task 2: Avisos del comensal (llamar mesero y pedir la cuenta)

**Files:**
- Modify: `backend/app/application/ports.py`, `backend/app/application/dto.py`, `backend/tests/fakes.py`
- Create: `backend/app/application/use_cases/service_calls.py`
- Test: `backend/tests/use_cases/test_service_calls.py`

**Interfaces:**
- Consumes: `apply_table_event`, `_table_by_qr` (Plan 1).
- Produces:
  - Puerto `ServiceCallRepository`: `add(call)`, `get_for_update(id)`, `save(call)`, `pending_for_session(session_id, type) -> ServiceCall | None`, `list_pending() -> list[ServiceCall]`. `UnitOfWork.service_calls`.
  - `request_service_call(uow, clock, qr_token, type) -> ServiceCall`: mesa sin sesión abierta (`free`/`closed`) → `TableNotOpen`. Si ya hay uno pendiente del mismo tipo en la sesión, lo devuelve sin escribir. `REQUEST_BILL` además aplica `TableEvent.BILL_REQUESTED` (fuente `DINER`) si la mesa no está ya en `bill_requested`, y fija `session.bill_requested_at`.
  - `attend_service_call(uow, clock, call_id, staff_id) -> ServiceCall`: fija `attended_at/by`; uno ya atendido → `InvalidTransition`.
  - `list_pending_calls(uow) -> list[ServiceCallView]`, `ServiceCallView(id, table_code, type, created_at)`, más antiguo primero.
  - `DinerSessionView` gana `bill_requested: bool` y `pending_calls: list[str]` (tipos pendientes).
  - Fake: `_ServiceCalls` sobre `state.service_calls: dict[UUID, ServiceCall]`.

- [ ] **Step 1: Write the failing tests**: `test_call_waiter_creates_pending_call`, `test_request_bill_moves_table_to_bill_requested` (historial `DINER`, `bill_requested_at` fijado), `test_request_bill_twice_keeps_one_call` (mismo id, un solo cambio de historial), `test_cannot_call_from_free_table` (`TableNotOpen`), `test_attend_twice_is_invalid_transition`, `test_session_view_reports_bill_and_calls`, `test_ordering_blocked_after_bill_requested` (usa `place_order` → `TableNotOpen`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(app): diner service calls and bill requests`

---

### Task 3: Cobro manual y cierre de la mesa

**Files:**
- Modify: `backend/app/application/ports.py`, `backend/tests/fakes.py`, `backend/app/application/use_cases/advance_order.py`
- Create: `backend/app/application/use_cases/payments.py`
- Test: `backend/tests/use_cases/test_payments.py`

**Interfaces:**
- Consumes: `apply_payment` (Task 1), `apply_table_event`.
- Produces:
  - Puerto `PaymentRepository`: `add(payment)`, `list_by_session(session_id)`. `UnitOfWork.payments`. Fake sobre `state.payments`.
  - `register_manual_payment(uow, clock, session_id, method, amount_cents, tip_cents, staff_id) -> Payment`: `method` solo `cash` o `card_terminal` (otro → `InvalidCustomization`). Bloquea mesa → sesión (orden del Plan 1). Sesión cerrada o inexistente → `NotFound`/`InvalidTransition`. Si la mesa está en `occupied/awaiting_order/served`, primero aplica `BILL_REQUESTED` (fuente `STAFF`). Crea `Payment(status=APPROVED, paid_at=now, received_by=staff)`. Si `apply_payment` devuelve `True`: `session.paid_at = now`, `TableEvent.PAID` con fuente `PAYMENT`, y marca atendidos los avisos `request_bill` pendientes de la sesión.
  - `cancel_order` rechaza con `InvalidTransition` si la sesión de la orden tiene `closed_at` o `paid_at`.
  - Ruling ya tomado: con órdenes aún pendientes en cocina se permite cobrar.

- [ ] **Step 1: Write the failing tests**: `test_cash_payment_closes_table` (mesa `closed`, historial fuente `PAYMENT`, aviso de cuenta atendido), `test_split_payment_closes_on_second`, `test_payment_over_balance_is_rejected` (nada escrito: `state.payments` vacío), `test_waiter_payment_from_served_requests_bill_first` (historial `served→bill_requested→closed`), `test_mercado_pago_method_is_rejected_for_manual`, `test_cannot_cancel_after_session_closed`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(app): manual payments close the table`

---

### Task 4: Disponibilidad con log

**Files:**
- Modify: `backend/app/application/ports.py`, `backend/tests/fakes.py`
- Create: `backend/app/application/use_cases/availability.py`
- Test: `backend/tests/use_cases/test_availability_use_case.py`

**Interfaces:**
- Produces:
  - Puerto `AvailabilityRepository`: `set_available(entity: AvailabilityEntity, entity_id, is_available, staff_id) -> bool` (False si no existe o está borrado), `add_log(entity, entity_id, is_available, staff_id, at)`, `list_board() -> AvailabilityBoardView`. `UnitOfWork.availability`.
  - `set_availability(uow, clock, entity, entity_id, is_available, staff_id) -> None`: inexistente → `NotFound`; siempre escribe log, aun si el valor no cambió (registro de quién confirmó).
  - `AvailabilityBoardView(items: list[AvailabilityRow], ingredients: list[AvailabilityRow], extras: list[AvailabilityRow])`, `AvailabilityRow(id, name, is_available, used_in: int)` (`used_in` = platillos que lo usan; 0 para platillos). Sin borrados.
  - Fake: `state.availability: dict[tuple[AvailabilityEntity, UUID], bool]`, `state.availability_log: list`.

- [ ] **Step 1: Write the failing tests**: `test_set_availability_writes_log`, `test_unknown_entity_is_not_found`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(app): availability toggles with audit log`

---

### Task 5: Repositorios SQL de lo nuevo + catálogo filtrado

**Files:**
- Modify: `backend/app/infrastructure/db/tables.py`, `backend/app/infrastructure/db/repositories.py`, `backend/app/infrastructure/db/unit_of_work.py`
- Test: `backend/tests/integration/test_repositories_plan2.py`

**Interfaces:**
- Consumes: puertos de Tasks 2–4.
- Produces: `SqlServiceCallRepository`, `SqlPaymentRepository`, `SqlAvailabilityRepository` registrados en `SqlUnitOfWork`; `SqlSessionRepository` persiste `bill_requested_at` y `paid_at`.
  - `SqlMenuRepository` excluye extras e ingredientes con `deleted_at` y marca como `is_active=False` los platillos cuya categoría está inactiva o borrada (así el dominio los rechaza y el menú los oculta).

- [ ] **Step 1: Write the failing integration tests** (mismo estilo y limpieza que `test_repositories.py`): `test_bill_and_payment_roundtrip` (abrir M3, ordenar, pedir cuenta, pagar en efectivo → mesa `closed`, una fila en `payments`, aviso atendido), `test_availability_log_row_written`, `test_deleted_extra_and_hidden_category_are_not_orderable` (borra lógico el extra "Huevo pochado" y oculta "Jugos": `place_order` con cada uno → `ItemUnavailable`; restaurar al final).
- [ ] **Step 2: Run** `uv run pytest -m integration tests/integration/test_repositories_plan2.py -q` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `uv run pytest -m integration -q` completo verde.
- [ ] **Step 5: Commit** `feat(infra): SQL repositories for calls, payments and availability`

---

### Task 6: API de avisos, cobro y disponibilidad

**Files:**
- Modify: `backend/app/presentation/routers/diner.py`, `backend/app/presentation/routers/waiter.py`, `backend/app/presentation/schemas.py`, `backend/app/main.py`
- Create: `backend/app/presentation/routers/availability.py`
- Test: `backend/tests/api/test_bill_api.py`

**Interfaces:**
- Produces rutas:
  - `POST /diner/tables/{qr}/service-calls` body `{"type": "call_waiter"|"request_bill"}` → 201 `{"id","type","created_at"}` (comparte el límite de 10/min con las órdenes).
  - `GET /waiter/service-calls` → `list[ServiceCallView]`; `POST /waiter/service-calls/{id}/attend` → 204.
  - `POST /waiter/sessions/{id}/payments` body `{"method": "cash"|"card_terminal", "amount_cents": int ≥1, "tip_cents": int ≥0 = 0}` → 201 `{"payment_id","balance_cents","table_status"}`.
  - `POST /waiter/tables/{id}/request-bill` → 204 (el mesero pide la cuenta por el comensal).
  - `GET /availability` (kitchen) → `AvailabilityBoardView`; `PATCH /availability/{entity}/{id}` (kitchen) body `{"is_available": bool}` → 204. `entity` ∈ `menu_item|ingredient|extra`, otro → 422.
  - `TableMapView` gana `session_id: UUID | None`, `balance_cents: int` y `pending_calls: int` (el mesero los necesita para cobrar).

- [ ] **Step 1: Write the failing tests** (TestClient + fakes): `test_diner_requests_bill_and_waiter_charges` (flujo completo hasta `closed` y `GET /waiter/tables` con `balance_cents` 0), `test_kitchen_cannot_register_payment` (403), `test_payment_body_validation` (amount 0 → 422 `validation_error`), `test_call_waiter_from_free_table_is_403`, `test_kitchen_toggles_availability` (204; luego el menú del comensal marca el platillo no disponible), `test_waiter_cannot_toggle_availability` (403).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): service calls, manual payments and availability endpoints`

---

### Task 7: Admin de catálogo, fotos y mesas

**Files:**
- Create: `backend/app/application/use_cases/admin_catalog.py`, `backend/app/application/use_cases/admin_tables.py`, `backend/app/infrastructure/storage.py`, `backend/app/infrastructure/db/admin_repositories.py`, `backend/app/presentation/routers/admin.py`, `backend/app/presentation/admin_schemas.py`, `supabase/migrations/20261023000000_menu_photos_bucket.sql`
- Modify: `backend/app/infrastructure/config.py` (`supabase_service_role_key: str | None = None`, `public_app_url: str = "http://localhost:5173"`), `backend/.env.example`, `backend/pyproject.toml` (`segno`, `httpx` a dependencias de ejecución)
- Test: `backend/tests/integration/test_admin_catalog_api.py`, `backend/tests/api/test_admin_photo.py`

**Interfaces:**
- Produces:
  - `CatalogRepository` (puerto) con `list_*`, `create_*`, `update_*`, `soft_delete_*` para categorías, ingredientes, extras y platillos. Un platillo se escribe con sus listas `ingredients: [{ingredient_id, is_removable}]` y `extras: [{extra_id, max_quantity}]` reemplazando las filas de unión en la misma transacción.
  - `PhotoStorage` (puerto) `upload(path: str, content: bytes, content_type: str) -> None`; `SupabasePhotoStorage(supabase_url, service_role_key)` hace `POST {url}/storage/v1/object/menu-photos/{path}` con `x-upsert: true`.
  - `upload_menu_photo(uow, storage, item_id, content, content_type, staff_id) -> str`: solo `image/jpeg|png|webp`, máx 5 MB (si no, `InvalidCustomization`); ruta `items/{item_id}/{uuid}.{ext}`; guarda `photo_path`.
  - `AdminTableRepository`: `list`, `create(code, label, zone, capacity, qr_token)`, `update`, `soft_delete` (solo mesas `free`, si no `InvalidTransition`), `set_qr_token`.
  - `new_qr_token() -> str` = `secrets.token_urlsafe(24)` (32 caracteres).
  - Rutas (todas `require_roles()` = solo admin): `GET/POST /admin/categories`, `PATCH/DELETE /admin/categories/{id}`; ídem `/admin/ingredients`, `/admin/extras`, `/admin/menu-items` (el GET devuelve costo y precio, a diferencia del comensal); `POST /admin/menu-items/{id}/photo` (multipart `file`) → `{"photo_path"}`; `GET/POST /admin/tables`, `PATCH/DELETE /admin/tables/{id}`, `POST /admin/tables/{id}/regenerate-qr` → `{"qr_token"}`, `GET /admin/tables/{id}/qr.png` → PNG de `{public_app_url}/mesa/{qr_token}`.
  - Código duplicado de mesa o nombre duplicado de ingrediente → 409 `conflict` (nuevo `Conflict(DomainError)` mapeado a 409).
  - Migración: bucket público `menu-photos` (insert en `storage.buckets` con `on conflict do nothing`, protegido con `if exists` del esquema `storage`).

- [ ] **Step 1: Write the failing tests**: integración `test_admin_creates_dish_with_ingredients_and_extras` (aparece en `/diner/.../menu` con sus ingredientes), `test_admin_menu_shows_costs_diner_does_not`, `test_soft_deleted_item_disappears_from_menu`, `test_duplicate_table_code_is_409`, `test_regenerate_qr_invalidates_old_token`, `test_qr_png_encodes_public_url` (cabecera PNG y `segno` decodificable no es necesario: basta `content-type: image/png` y bytes que empiezan con `\x89PNG`), `test_non_admin_gets_403`; API con fakes `test_photo_upload_rejects_wrong_type_and_size` y `test_photo_upload_stores_path` (storage falso por `dependency_overrides`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(admin): catalog, photos and tables management`

---

### Task 8: Admin de personal, órdenes, dashboard y configuración

**Files:**
- Create: `backend/app/application/use_cases/admin_staff.py`, `backend/app/application/use_cases/dashboard.py`, `backend/app/infrastructure/auth/auth_admin.py`
- Modify: `backend/app/infrastructure/db/admin_repositories.py`, `backend/app/presentation/routers/admin.py`, `backend/app/presentation/admin_schemas.py`
- Test: `backend/tests/integration/test_admin_reports_api.py`, `backend/tests/api/test_admin_staff.py`

**Interfaces:**
- Produces:
  - `AuthAdmin` (puerto) `create_user(email, password) -> UUID`; `SupabaseAuthAdmin` llama `POST {url}/auth/v1/admin/users` con `{"email","password","email_confirm": true}` y la service role. Sin service role configurada → 503 `service_unavailable`.
  - `create_staff(uow, auth, email, password, full_name, role, admin_id) -> StaffMember`; `update_staff(uow, staff_id, full_name?, role?, is_active?, admin_id)`; un admin no puede desactivarse ni quitarse el rol a sí mismo (`InvalidTransition`). Rutas `GET/POST /admin/staff`, `PATCH /admin/staff/{id}`. Password mínimo 8.
  - `GET /admin/orders?from=YYYY-MM-DD&to=YYYY-MM-DD&status=&table=` → lista con `daily_number, table_code, round_number, status, subtotal_cents, cost_cents, created_at, ready_at, served_at, cancel_reason`, más reciente primero, máximo 500.
  - `get_dashboard(uow, day: date, timezone) -> DashboardView` con exactamente los indicadores de la spec: `sales_cents`, `tips_cents`, `profit_cents` (ventas − costo de órdenes no canceladas de sesiones pagadas ese día), `margin_pct` (1 decimal, 0 si no hay ventas), `orders_count`, `cancelled_count`, `cancel_reasons: list[str]`, `avg_ticket_cents` (ventas / sesiones pagadas), `avg_prep_seconds`, `avg_delivery_seconds` (`None` sin datos), `occupied_tables`, `total_tables`, `sales_by_hour: list[{hour: 0-23, sales_cents}]` (24 entradas). Ventas = `payments.amount_cents` aprobados con `paid_at` en el día local.
  - `GET /admin/dashboard?date=YYYY-MM-DD` (default hoy local); `GET /admin/settings` y `PUT /admin/settings` con `name`, `auto_release_minutes` (0–240), `tip_options` (lista de 1–5 enteros 1–100).

- [ ] **Step 1: Write the failing tests**: API con fakes `test_create_staff_calls_auth_admin`, `test_admin_cannot_deactivate_self`; integración `test_dashboard_counts_one_paid_session` (con un reloj fijo en 2031-01-15 18:00 hora local: abrir mesa, 1 orden de 16500 costo 5200, servir, pagar 16500 + 2000 propina → ventas 16500, propinas 2000, ganancia 11300, margen 68.5, ticket 16500, `sales_by_hour[18]` = 16500), `test_orders_history_filters_by_status`, `test_settings_roundtrip_and_validation`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; `uv run pytest -q`, `uv run pytest -m integration -q` y `uv run ruff check .` verdes.
- [ ] **Step 5: Commit** `feat(admin): staff, orders history, dashboard and settings`

---

## Self-review

- **Cobertura:** avisos y pedir cuenta (2, 6), cobro manual y cierre (1, 3, 6), disponibilidad con log y pantalla rápida (4, 5, 6), CRUD de menú con fotos (7), mesas y QR imprimible (7), personal (8), historial de órdenes, dashboard y configuración (8). Fuera: Mercado Pago (Plan 5).
- **Desviaciones conscientes:** `PATCH /availability` solo cocina+admin (spec); pruebas del CRUD de admin solo de integración porque no hay reglas que justifiquen dobles en memoria.
- **Tipos:** `ServiceCall`, `Payment`, `AvailabilityEntity` y los puertos nuevos se usan con los mismos nombres en Tasks 2–8.
