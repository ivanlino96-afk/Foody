# Foody — Plan 1: Backend núcleo — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un backend FastAPI con el esquema completo en Supabase donde el mesero abre una mesa, el comensal ordena por QR con precio calculado en el servidor, cocina avanza la orden y el mesero la sirve, con historial completo.

**Architecture:** Clean Architecture en `backend/app/`: `domain` (Python puro: reglas de precio, disponibilidad y máquinas de estado), `application` (casos de uso sobre puertos `Protocol` y una `UnitOfWork`), `infrastructure` (SQLAlchemy 2 sobre el Postgres de Supabase, verificación de JWT) y `presentation` (routers FastAPI). Las migraciones viven en `supabase/migrations/` porque así las aplica la CLI de Supabase.

**Tech Stack:** Python 3.12, uv, FastAPI, Pydantic 2, SQLAlchemy 2 + psycopg 3, PyJWT[crypto], slowapi, APScheduler, pytest, httpx, Supabase CLI (Postgres local en Docker).

**Spec:** [Foody — Spec de diseño v1](https://claude.ai/artifact/XF2pj8rMVHXiPMSSeUWYmy). Roadmap: [2026-10-22-foody-roadmap.md](2026-10-22-foody-roadmap.md).

## Global Constraints

- Montos en centavos MXN, siempre `int`; nunca `float`.
- Zona horaria del negocio: `America/Mexico_City` (cortes del día y `daily_number`).
- `app/domain` no importa FastAPI, SQLAlchemy, Pydantic ni Supabase; `app/application` solo importa `domain` y sus propios puertos.
- El precio lo calcula el servidor; el cliente manda solo ids, cantidades y notas (más `expected_total_cents` para detectar cambios).
- REST bajo `/api/v1`. Errores con forma única `{"code": str, "message": str, "details": dict}`.
- `qr_token`: 32 caracteres aleatorios URL-safe (`secrets.token_urlsafe(24)`).
- `auto_release_minutes` por defecto 5.
- Límite en rutas del comensal: 10 órdenes por minuto por `qr_token` + IP.
- RLS: el rol `anon` no lee ni escribe ninguna tabla; el personal autenticado solo lee; toda escritura va por FastAPI con la llave de servicio / `DATABASE_URL`.
- Estados de mesa: `free, occupied, awaiting_order, served, bill_requested, closed`. Estados de orden: `received, preparing, ready, served, cancelled`. Origen de cambio: `staff, diner, system, payment`. Roles: `admin, kitchen, waiter`.
- Columnas comunes en todas las tablas: `id uuid pk default gen_random_uuid()`, `created_at`, `updated_at`, `created_by`, `updated_by` (FK `staff`, nullables).
- Commits con mensajes convencionales (`feat:`, `test:`, `chore:`).

## Review Focus

1. **Dos celulares de la misma mesa envían a la vez.** Ambas órdenes entran, cada una con `daily_number` distinto y los totales de la sesión suman bien. Prueba: Task 13 `test_concurrent_orders_get_distinct_daily_numbers`.
2. **Cantidades absurdas en el carrito** (0, negativas, 1000, un extra repetido dos veces en la misma línea, más extras que `max_quantity`). Se rechazan con 422 o `invalid_customization`, nunca 500. Pruebas: Task 4 `test_rejects_bad_quantities` y Task 15 `test_place_order_rejects_quantity_zero`.
3. **QR de una mesa con cuenta pedida, cerrada o libre intentando ordenar.** 403 `table_not_open`, sin crear orden. Prueba: Task 9 `test_cannot_order_when_bill_requested`.
4. **Doble toque de cocina en "Lista".** El segundo responde 409 `invalid_transition` y no duplica historial. Prueba: Task 10 `test_double_ready_is_rejected_without_history`.
5. **Platillo desactivado o borrado que sigue en un carrito viejo.** Responde `item_unavailable` con la línea, no 500. Prueba: Task 4 `test_inactive_or_deleted_item_is_unavailable`.

---

## File Structure

```
foody/
├── supabase/
│   ├── config.toml                      (supabase init)
│   ├── migrations/20261022000000_core_schema.sql
│   └── seed.sql                         datos demo: 6 mesas, 3 categorías, platillos, staff
└── backend/
    ├── pyproject.toml
    ├── .env.example
    ├── app/
    │   ├── main.py                      create_app()
    │   ├── domain/
    │   │   ├── enums.py                 TableStatus, OrderStatus, ChangeSource, StaffRole, TableEvent
    │   │   ├── entities.py              Ingredient, ItemIngredient, Extra, ItemExtra, MenuItem, DiningTable, TableSession, Order, OrderLine…
    │   │   ├── errors.py                DomainError y subclases con `code`
    │   │   └── services/
    │   │       ├── availability.py
    │   │       ├── pricing.py
    │   │       ├── table_state_machine.py
    │   │       └── order_state_machine.py
    │   ├── application/
    │   │   ├── ports.py                 repositorios, UnitOfWork, Clock (Protocols)
    │   │   ├── dto.py                   comandos y vistas de lectura (dataclasses)
    │   │   └── use_cases/
    │   │       ├── tables.py            open_table, reopen_table, release_table, release_expired_tables
    │   │       ├── place_order.py
    │   │       ├── advance_order.py     advance_order, cancel_order
    │   │       └── queries.py           get_diner_table, get_diner_menu, get_diner_session, get_active_orders, get_tables_map
    │   ├── infrastructure/
    │   │   ├── config.py                Settings (pydantic-settings)
    │   │   ├── clock.py                 SystemClock
    │   │   ├── db/
    │   │   │   ├── engine.py
    │   │   │   ├── tables.py            SQLAlchemy Core Table objects
    │   │   │   ├── repositories.py
    │   │   │   └── unit_of_work.py      SqlUnitOfWork
    │   │   ├── auth/jwt_verifier.py
    │   │   └── scheduler.py
    │   └── presentation/
    │       ├── errors.py                manejadores DomainError → JSON
    │       ├── deps.py                  get_uow, current_staff, require_roles, limiter
    │       ├── schemas.py               Pydantic de entrada/salida
    │       └── routers/ diner.py, kitchen.py, waiter.py
    └── tests/
        ├── fakes.py                     InMemoryUnitOfWork, FixedClock, builders
        ├── unit/                        test_availability.py, test_pricing.py, test_table_state_machine.py, test_order_state_machine.py
        ├── use_cases/                   test_tables.py, test_place_order.py, test_advance_order.py, test_queries.py
        ├── integration/                 test_repositories.py (marker `integration`)
        └── api/                         test_health.py, test_diner_api.py, test_staff_api.py
```

---

### Task 1: Esqueleto del backend

**Files:**
- Create: `backend/pyproject.toml`, `backend/.env.example`, `backend/app/__init__.py` (y `__init__.py` en cada paquete del árbol), `backend/app/main.py`, `backend/app/infrastructure/config.py`
- Test: `backend/tests/api/test_health.py`

**Interfaces:**
- Produces: `create_app(settings: Settings | None = None) -> FastAPI`; `Settings` con `database_url: str`, `supabase_url: str`, `supabase_jwt_secret: str | None`, `timezone: str = "America/Mexico_City"`, `cors_origins: list[str] = ["http://localhost:5173"]`, `enable_scheduler: bool = True`.

- [ ] **Step 1: Crear `pyproject.toml`** con dependencias `fastapi`, `uvicorn[standard]`, `pydantic-settings`, `sqlalchemy>=2`, `psycopg[binary]>=3`, `pyjwt[crypto]`, `slowapi`, `apscheduler>=3,<4`; dev: `pytest`, `httpx`, `ruff`. `[tool.pytest.ini_options]`: `markers = ["integration: needs local Supabase"]`, `addopts = "-m 'not integration'"`.

- [ ] **Step 2: Write the failing test**

```python
def test_health_returns_ok():
    client = TestClient(create_app(Settings(database_url="sqlite://", supabase_url="http://x", enable_scheduler=False)))
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
```

- [ ] **Step 3: Run** `cd backend && uv run pytest tests/api/test_health.py -v` → FAIL (`create_app` no existe).
- [ ] **Step 4: Implement** `create_app` con CORS desde `settings.cors_origins` y `GET /api/v1/health`.
- [ ] **Step 5: Run** el mismo comando → PASS. `uv run ruff check .` → sin errores.
- [ ] **Step 6: Commit** `chore: scaffold backend with health endpoint`

---

### Task 2: Enums, entidades y errores del dominio

**Files:**
- Create: `backend/app/domain/enums.py`, `backend/app/domain/entities.py`, `backend/app/domain/errors.py`
- Test: `backend/tests/unit/test_errors.py`

**Interfaces:**
- Produces (todos `StrEnum`): `TableStatus`, `OrderStatus`, `ChangeSource`, `StaffRole` con los valores de Global Constraints; `TableEvent`: `OPEN, ORDER_PLACED, ALL_SERVED, BILL_REQUESTED, PAID, RELEASE, REOPEN`.
- Produces (`@dataclass(frozen=True)` salvo indicación):
  - `Ingredient(id: UUID, name: str, is_available: bool)`
  - `ItemIngredient(ingredient: Ingredient, is_removable: bool)`
  - `Extra(id: UUID, name: str, price_cents: int, cost_cents: int, is_available: bool, ingredient: Ingredient | None)`
  - `ItemExtra(extra: Extra, max_quantity: int = 1)`
  - `MenuItem(id: UUID, category_id: UUID, name: str, price_cents: int, cost_cents: int, is_available: bool, is_active: bool, is_deleted: bool, ingredients: tuple[ItemIngredient, ...], extras: tuple[ItemExtra, ...], description: str = "", photo_path: str | None = None, prep_minutes: int | None = None, tags: tuple[str, ...] = ())`
  - `DiningTable` (mutable): `id, code, label, zone, capacity, qr_token, status: TableStatus, current_session_id: UUID | None, status_changed_at: datetime`
  - `TableSession` (mutable): `id, table_id, opened_by: UUID | None, opened_at, guests_count: int | None, subtotal_cents=0, cost_cents=0, tip_cents=0, paid_cents=0, closed_at: datetime | None = None`
  - `Order` (mutable): `id, session_id, table_id, daily_number: int, round_number: int, status: OrderStatus, idempotency_key: UUID, subtotal_cents, cost_cents, lines: list[PricedLine], created_at, preparing_at=None, ready_at=None, served_at=None, cancelled_at=None, cancelled_by=None, cancel_reason=None`
  - `StatusChange(entity_id: UUID, session_id: UUID | None, from_status: str | None, to_status: str, source: ChangeSource, changed_by: UUID | None, changed_at: datetime)`
- Produces (`errors.py`): `DomainError(Exception)` con atributos `code: str`, `message: str`, `details: dict`; subclases y su `code`: `InvalidTransition` `"invalid_transition"`, `TableNotOpen` `"table_not_open"`, `ItemUnavailable` `"item_unavailable"` (details `{"lines": [{"index": int, "menu_item_id": str, "reason": str}]}`), `InvalidCustomization` `"invalid_customization"`, `PriceChanged` `"price_changed"` (details `{"total_cents": int}`), `NotFound` `"not_found"`, `Forbidden` `"forbidden"`.

- [ ] **Step 1: Write the failing test**

```python
def test_item_unavailable_carries_code_and_lines():
    err = ItemUnavailable(lines=[{"index": 0, "menu_item_id": "a", "reason": "item_disabled"}])
    assert err.code == "item_unavailable"
    assert err.details == {"lines": [{"index": 0, "menu_item_id": "a", "reason": "item_disabled"}]}

def test_table_status_values():
    assert [s.value for s in TableStatus] == ["free", "occupied", "awaiting_order", "served", "bill_requested", "closed"]
```

- [ ] **Step 2: Run** `uv run pytest tests/unit/test_errors.py -v` → FAIL.
- [ ] **Step 3: Implement** los tres archivos; `PricedLine` se importa de `services/pricing.py` (Task 4), así que en este task define `Order.lines` con anotación de string `"list[PricedLine]"` y `from __future__ import annotations`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): add enums, entities and errors`

---

### Task 3: Disponibilidad efectiva

**Files:**
- Create: `backend/app/domain/services/availability.py`
- Test: `backend/tests/unit/test_availability.py`

**Interfaces:**
- Consumes: entidades de Task 2.
- Produces:
  - `extra_available(extra: Extra) -> bool` → `extra.is_available and (extra.ingredient is None or extra.ingredient.is_available)`
  - `ItemAvailability(available: bool, reason: str | None, unavailable_ingredient_ids: frozenset[UUID], unavailable_extra_ids: frozenset[UUID])`
  - `item_availability(item: MenuItem) -> ItemAvailability`. Reglas en orden: `is_deleted` o `not is_active` → `reason="item_inactive"`; `not is_available` → `"item_disabled"`; algún ingrediente con `is_removable=False` no disponible → `f"ingredient_unavailable:{name}"`. Los removibles no disponibles y los extras no disponibles solo van a sus conjuntos y no apagan el platillo.

- [ ] **Step 1: Write the failing tests** (builders locales `make_item(...)`, `make_ingredient(...)`):

```python
def test_disabled_item_is_unavailable():
    assert item_availability(make_item(is_available=False)).reason == "item_disabled"

def test_essential_ingredient_out_turns_item_off():
    tortilla = make_ingredient("Tortilla", available=False)
    a = item_availability(make_item(ingredients=[ItemIngredient(tortilla, is_removable=False)]))
    assert a.available is False and a.reason == "ingredient_unavailable:Tortilla"

def test_removable_ingredient_out_keeps_item_on():
    cebolla = make_ingredient("Cebolla", available=False)
    a = item_availability(make_item(ingredients=[ItemIngredient(cebolla, is_removable=True)]))
    assert a.available is True and a.unavailable_ingredient_ids == frozenset({cebolla.id})

def test_extra_off_when_its_ingredient_is_out():
    aguacate = make_ingredient("Aguacate", available=False)
    extra = make_extra("Aguacate extra", ingredient=aguacate)
    assert extra_available(extra) is False
    assert item_availability(make_item(extras=[ItemExtra(extra)])).unavailable_extra_ids == frozenset({extra.id})

def test_inactive_or_deleted_item_is_unavailable():
    assert item_availability(make_item(is_active=False)).reason == "item_inactive"
    assert item_availability(make_item(is_deleted=True)).reason == "item_inactive"
```

- [ ] **Step 2: Run** `uv run pytest tests/unit/test_availability.py -v` → FAIL.
- [ ] **Step 3: Implement** las dos funciones.
- [ ] **Step 4: Run** → PASS. Mueve los builders a `tests/fakes.py` (se reutilizan desde Task 4).
- [ ] **Step 5: Commit** `feat(domain): effective availability for items, ingredients and extras`

---

### Task 4: Cálculo de precio y costo

**Files:**
- Create: `backend/app/domain/services/pricing.py`
- Modify: `backend/tests/fakes.py` (builders)
- Test: `backend/tests/unit/test_pricing.py`

**Interfaces:**
- Consumes: `item_availability`, `extra_available` (Task 3); errores (Task 2).
- Produces:
  - `ExtraRequest(extra_id: UUID, quantity: int = 1)`
  - `LineRequest(menu_item_id: UUID, quantity: int, removed_ingredient_ids: tuple[UUID, ...] = (), extras: tuple[ExtraRequest, ...] = (), note: str | None = None)`
  - `PricedExtra(extra_id, name, unit_price_cents, unit_cost_cents, quantity)`
  - `RemovedIngredient(ingredient_id, name)`
  - `PricedLine(menu_item_id, item_name, unit_price_cents, unit_cost_cents, quantity, note, extras: tuple[PricedExtra, ...], removed: tuple[RemovedIngredient, ...], line_total_cents, line_cost_cents)`
  - `PricedOrder(lines: tuple[PricedLine, ...], subtotal_cents: int, cost_cents: int)`
  - `price_order(menu: Mapping[UUID, MenuItem], requests: Sequence[LineRequest]) -> PricedOrder`
- Reglas (la spec las fija):
  - `line_total_cents = (item.price_cents + Σ extra.price_cents × extra.quantity) × quantity`; igual para costo.
  - `1 <= quantity <= 50` por línea y `1 <= extra.quantity <= ItemExtra.max_quantity`; un `extra_id` repetido en la misma línea, un extra que no pertenece al platillo o quitar un ingrediente con `is_removable=False` o ajeno al platillo → `InvalidCustomization` con `details={"index": i, "field": ...}`. `requests` vacío → `InvalidCustomization(details={"field": "lines"})`.
  - Platillo inexistente en `menu` o no disponible, o extra elegido no disponible → se acumulan todas las líneas y se lanza **un** `ItemUnavailable(lines=[...])` (`reason`: la de `item_availability`, `"not_found"` o `f"extra_unavailable:{name}"`).
  - Ingredientes removibles agotados se agregan solos a `removed` aunque el comensal no los haya quitado.
  - `item_name`, `name` y precios se copian del menú en ese momento.

- [ ] **Step 1: Write the failing tests**

```python
def test_line_total_includes_extras_times_quantity():
    queso = make_extra("Queso extra", price_cents=2500, cost_cents=800)
    taco = make_item("Taco", price_cents=4000, cost_cents=1500, extras=[ItemExtra(queso, max_quantity=2)])
    po = price_order({taco.id: taco}, [LineRequest(taco.id, 3, extras=(ExtraRequest(queso.id, 2),))])
    assert po.lines[0].line_total_cents == (4000 + 2500 * 2) * 3 == 27000
    assert po.cost_cents == (1500 + 800 * 2) * 3
    assert po.subtotal_cents == 27000

def test_unavailable_removable_ingredient_is_removed_automatically():
    cebolla = make_ingredient("Cebolla", available=False)
    taco = make_item(ingredients=[ItemIngredient(cebolla, True)])
    line = price_order({taco.id: taco}, [LineRequest(taco.id, 1)]).lines[0]
    assert line.removed == (RemovedIngredient(cebolla.id, "Cebolla"),)

def test_collects_every_unavailable_line():
    off = make_item(is_available=False); ok = make_item()
    with pytest.raises(ItemUnavailable) as e:
        price_order({off.id: off, ok.id: ok}, [LineRequest(ok.id, 1), LineRequest(off.id, 1), LineRequest(uuid4(), 1)])
    assert [l["index"] for l in e.value.details["lines"]] == [1, 2]
    assert e.value.details["lines"][1]["reason"] == "not_found"

def test_cannot_remove_essential_ingredient():
    tortilla = make_ingredient("Tortilla")
    taco = make_item(ingredients=[ItemIngredient(tortilla, False)])
    with pytest.raises(InvalidCustomization):
        price_order({taco.id: taco}, [LineRequest(taco.id, 1, removed_ingredient_ids=(tortilla.id,))])

@pytest.mark.parametrize("qty", [0, -1, 51])
def test_rejects_bad_quantities(qty):
    taco = make_item()
    with pytest.raises(InvalidCustomization):
        price_order({taco.id: taco}, [LineRequest(taco.id, qty)])

def test_rejects_duplicate_or_excess_extras():
    queso = make_extra("Queso"); taco = make_item(extras=[ItemExtra(queso, max_quantity=1)])
    for extras in [(ExtraRequest(queso.id), ExtraRequest(queso.id)), (ExtraRequest(queso.id, 2),), (ExtraRequest(uuid4()),)]:
        with pytest.raises(InvalidCustomization):
            price_order({taco.id: taco}, [LineRequest(taco.id, 1, extras=extras)])

def test_inactive_or_deleted_item_is_unavailable():
    gone = make_item(is_deleted=True)
    with pytest.raises(ItemUnavailable) as e:
        price_order({gone.id: gone}, [LineRequest(gone.id, 1)])
    assert e.value.details["lines"][0]["reason"] == "item_inactive"
```

- [ ] **Step 2: Run** `uv run pytest tests/unit/test_pricing.py -v` → FAIL.
- [ ] **Step 3: Implement** `price_order` y los dataclasses. Valida primero `InvalidCustomization` por línea (falla en la primera), después acumula disponibilidad.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): server-side order pricing and cost`

---

### Task 5: Máquina de estados de la mesa

**Files:**
- Create: `backend/app/domain/services/table_state_machine.py`
- Test: `backend/tests/unit/test_table_state_machine.py`

**Interfaces:**
- Produces: `next_table_status(current: TableStatus, event: TableEvent) -> TableStatus` (lanza `InvalidTransition(details={"from": ..., "event": ...})`) y `can_order(status: TableStatus) -> bool`.
- Tabla de transiciones (exacta, de la spec):

| Evento | Desde | Hacia |
|---|---|---|
| OPEN | free | occupied |
| ORDER_PLACED | occupied, awaiting_order, served | awaiting_order |
| ALL_SERVED | awaiting_order | served |
| BILL_REQUESTED | occupied, awaiting_order, served | bill_requested |
| PAID | bill_requested | closed |
| RELEASE | closed | free |
| REOPEN | closed | occupied |

- `can_order` es `True` solo en `occupied, awaiting_order, served`.

- [ ] **Step 1: Write the failing tests**: un `@pytest.mark.parametrize` con cada fila válida de la tabla; otro que recorre **todas** las combinaciones `TableStatus × TableEvent` fuera de la tabla y espera `InvalidTransition`; `test_cannot_order_after_bill_requested`: `can_order(TableStatus.BILL_REQUESTED) is False` y `can_order(TableStatus.CLOSED) is False`.
- [ ] **Step 2: Run** `uv run pytest tests/unit/test_table_state_machine.py -v` → FAIL.
- [ ] **Step 3: Implement** con un `dict[TableEvent, tuple[frozenset[TableStatus], TableStatus]]`.
- [ ] **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): table state machine`

---

### Task 6: Máquina de estados de la orden

**Files:**
- Create: `backend/app/domain/services/order_state_machine.py`
- Test: `backend/tests/unit/test_order_state_machine.py`

**Interfaces:**
- Produces: `check_order_transition(current: OrderStatus, target: OrderStatus, role: StaffRole) -> None` (lanza `InvalidTransition` o `Forbidden`) y `is_pending(status: OrderStatus) -> bool` (`received, preparing, ready`).
- Transiciones y roles permitidos (Admin siempre puede):

| Desde → Hacia | Roles |
|---|---|
| received → preparing | kitchen |
| preparing → ready | kitchen |
| ready → served | waiter |
| received → cancelled, preparing → cancelled | waiter |

- [ ] **Step 1: Write the failing tests**: parametrize de cada fila válida con su rol y con `ADMIN`; `test_kitchen_cannot_serve` (`Forbidden`); `test_cannot_cancel_ready_or_served` (`InvalidTransition`); `test_cannot_skip_preparing` (`received → ready` → `InvalidTransition`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(domain): order state machine with role rules`

---

### Task 7: Puertos y dobles en memoria

**Files:**
- Create: `backend/app/application/ports.py`, `backend/app/application/dto.py`
- Modify: `backend/tests/fakes.py`
- Test: `backend/tests/use_cases/test_fakes.py`

**Interfaces:**
- Produces (`ports.py`, todos `Protocol`):
  - `Clock.now() -> datetime` (aware UTC) y `Clock.business_date() -> date` (fecha en `America/Mexico_City`).
  - `TableRepository`: `get(id) -> DiningTable | None`, `get_by_qr(token) -> DiningTable | None`, `get_for_update(id) -> DiningTable | None`, `list_active() -> list[DiningTable]`, `list_by_status(status) -> list[DiningTable]`, `save(table) -> None`.
  - `SessionRepository`: `get(id)`, `get_for_update(id)`, `add(session)`, `save(session)`.
  - `MenuRepository`: `get_items(ids: Iterable[UUID]) -> dict[UUID, MenuItem]`, `list_menu() -> list[MenuCategoryView]`.
  - `OrderRepository`: `get(id)`, `get_for_update(id)`, `get_by_idempotency_key(key) -> Order | None`, `add(order)`, `save(order)`, `list_by_session(session_id) -> list[Order]`, `list_by_status(statuses) -> list[Order]`, `next_round_number(session_id) -> int`, `next_daily_number(day: date) -> int`.
  - `HistoryRepository`: `add_table_change(change: StatusChange)`, `add_order_change(change: StatusChange)`.
  - `UnitOfWork`: atributos `tables, sessions, menu, orders, history`; `commit()`, `rollback()`; uso como context manager (`with uow:` hace rollback si no hubo commit).
- Produces (`dto.py`): `MenuCategoryView(id, name, items: list[MenuItem])` y las vistas de lectura de Task 11.
- Produces (`tests/fakes.py`): `InMemoryUnitOfWork` que implementa todos los puertos con dicts, cuenta `commits`, y `FixedClock(now: datetime)`.

- [ ] **Step 1: Write the failing test** `test_inmemory_uow_rolls_back_without_commit`: dentro de `with uow:` agrega una mesa sin `commit()`; después `uow.tables.get(id) is None`. Y `test_next_daily_number_increments_per_day`: dos llamadas el mismo día → 1, 2; otro día → 1.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** puertos y fakes (el fake copia el estado al entrar y lo restaura si no hubo commit). **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(application): ports, unit of work and in-memory fakes`

---

### Task 8: Abrir, reabrir y liberar mesas

**Files:**
- Create: `backend/app/application/use_cases/tables.py`
- Test: `backend/tests/use_cases/test_tables.py`

**Interfaces:**
- Consumes: `next_table_status` (Task 5), puertos (Task 7).
- Produces:
  - `open_table(uow, clock, table_id: UUID, staff_id: UUID, guests_count: int | None = None) -> TableSession`
  - `reopen_table(uow, clock, table_id, staff_id, guests_count=None) -> TableSession` (Cerrada → Ocupada con sesión nueva; cierra la anterior con `closed_at`)
  - `release_table(uow, clock, table_id, staff_id: UUID | None) -> None` (Cerrada → Libre; `current_session_id=None`; cierra la sesión)
  - `release_expired_tables(uow, clock, auto_release_minutes: int) -> int` (libera las `closed` con `status_changed_at <= now - minutos`, origen `system`; devuelve cuántas)
- Cada cambio de estado de mesa: actualiza `status` y `status_changed_at`, guarda un `StatusChange` vía `history.add_table_change` y hace `commit()` una vez.

- [ ] **Step 1: Write the failing tests**
  - `test_open_table_creates_session_and_history`: mesa `free` → `occupied`, `current_session_id == session.id`, `session.opened_by == staff_id`, un registro de historial `free→occupied` con `source=staff`.
  - `test_open_busy_table_fails`: mesa `occupied` → `InvalidTransition`, sin commits.
  - `test_reopen_closed_table_starts_new_account`: mesa `closed` con sesión A → `occupied` con sesión B ≠ A y `A.closed_at == clock.now()`.
  - `test_release_expired_tables_only_after_minutes`: dos mesas `closed`, una hace 6 min y otra hace 2 min, `auto_release_minutes=5` → devuelve 1 y solo la primera queda `free`, historial con `source=system`.
  - `test_unknown_table_raises_not_found`.
- [ ] **Step 2: Run** `uv run pytest tests/use_cases/test_tables.py -v` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(application): open, reopen and release tables`

---

### Task 9: Colocar una orden

**Files:**
- Create: `backend/app/application/use_cases/place_order.py`
- Test: `backend/tests/use_cases/test_place_order.py`

**Interfaces:**
- Consumes: `price_order` (Task 4), `next_table_status`, `can_order` (Task 5), puertos (Task 7).
- Produces: `PlaceOrderCommand(qr_token: str, idempotency_key: UUID, lines: tuple[LineRequest, ...], expected_total_cents: int | None)` y `place_order(uow, clock, cmd) -> Order`.
- Pasos dentro de una sola transacción:
  1. `get_by_idempotency_key` → si existe, devolverla sin cambios.
  2. Mesa por `qr_token` (`NotFound` si no hay) y bloquearla con `get_for_update`; si `not can_order(status)` → `TableNotOpen`.
  3. `price_order(menu.get_items(ids), lines)`; si `expected_total_cents` no es `None` y difiere de `subtotal_cents` → `PriceChanged(total_cents=...)`.
  4. Crear `Order(status=received, round_number=next_round_number, daily_number=next_daily_number(clock.business_date()))`, historial de orden `None→received` con `source=diner`.
  5. Sesión: `subtotal_cents += ...`, `cost_cents += ...`.
  6. Mesa: `ORDER_PLACED` (historial con `source=diner` solo si el estado cambia). `commit()`.

- [ ] **Step 1: Write the failing tests**
  - `test_places_order_and_updates_session_and_table`: mesa `occupied` → orden `received`, `round_number == 1`, `daily_number == 1`, sesión con subtotal y costo, mesa `awaiting_order`.
  - `test_second_round_after_served`: mesa `served` → `round_number == 2`, mesa `awaiting_order`.
  - `test_same_idempotency_key_returns_same_order`: dos llamadas → mismo `id`, un solo pedido guardado, subtotal sumado una vez.
  - `test_cannot_order_when_bill_requested`: con `bill_requested`, `closed` y `free` → `TableNotOpen` y ninguna orden guardada.
  - `test_price_changed_when_expected_total_differs`: `expected_total_cents = real - 100` → `PriceChanged` con `details == {"total_cents": real}`.
  - `test_unavailable_item_rolls_back`: `ItemUnavailable` y la sesión sin cambios.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(application): place order use case`

---

### Task 10: Avanzar y cancelar órdenes

**Files:**
- Create: `backend/app/application/use_cases/advance_order.py`
- Test: `backend/tests/use_cases/test_advance_order.py`

**Interfaces:**
- Consumes: `check_order_transition`, `is_pending` (Task 6), `next_table_status` (Task 5).
- Produces:
  - `advance_order(uow, clock, order_id: UUID, target: OrderStatus, staff_id: UUID, role: StaffRole) -> Order` (targets `preparing`, `ready`, `served`; pone `preparing_at`, `ready_at` o `served_at` con `clock.now()`)
  - `cancel_order(uow, clock, order_id, staff_id, role, reason: str) -> Order` (`reason` no vacío, si no `InvalidCustomization`; resta `subtotal_cents` y `cost_cents` de la sesión; pone `cancelled_at`, `cancelled_by`, `cancel_reason`)
- Después de `served` o `cancelled`: si la mesa está `awaiting_order` y ninguna orden de la sesión `is_pending`, dispara `ALL_SERVED` (historial `source=system`).
- Bloquea la orden con `get_for_update` para que dos toques simultáneos no pasen ambos.

- [ ] **Step 1: Write the failing tests**
  - `test_kitchen_moves_to_preparing_and_ready_with_timestamps`.
  - `test_double_ready_is_rejected_without_history`: segunda llamada a `ready` → `InvalidTransition`; el historial de la orden tiene exactamente `received, preparing, ready`.
  - `test_serving_last_pending_order_marks_table_served`: dos órdenes; servir la primera deja la mesa en `awaiting_order`, servir la segunda la pasa a `served`.
  - `test_cancel_subtracts_from_session_and_can_finish_round`: cancelar la única orden pendiente → sesión en 0 y mesa `served`.
  - `test_cancel_requires_reason` y `test_kitchen_cannot_cancel` (`Forbidden`).
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(application): advance and cancel orders`

---

### Task 11: Consultas de lectura

**Files:**
- Create: `backend/app/application/use_cases/queries.py`
- Modify: `backend/app/application/dto.py`
- Test: `backend/tests/use_cases/test_queries.py`

**Interfaces:**
- Produces (vistas en `dto.py`):
  - `DinerTableView(code, label, status: TableStatus, can_order: bool)`
  - `DinerMenuItemView(id, name, description, price_cents, photo_path, prep_minutes, tags, available: bool, unavailable_reason: str | None, ingredients: list[{id, name, is_removable, available}], extras: list[{id, name, price_cents, max_quantity, available}])` agrupado en `DinerMenuCategoryView(id, name, items)`
  - `DinerSessionView(rounds: list[{order_id, round_number, status, lines, subtotal_cents, created_at}], subtotal_cents, tip_cents, paid_cents, balance_cents)`
  - `KitchenOrderView(id, daily_number, table_code, round_number, status, created_at, lines)`
  - `TableMapView(id, code, label, zone, status, status_changed_at, pending_orders: int, ready_orders: int)`
- Produces (funciones): `get_diner_table(uow, qr_token)`, `get_diner_menu(uow) -> list[DinerMenuCategoryView]` (sin `cost_cents`; omite items inactivos o borrados, deja los agotados con `available=False`), `get_diner_session(uow, qr_token) -> DinerSessionView | None` (sin sesión abierta → `None`), `get_active_orders(uow) -> list[KitchenOrderView]` (`received, preparing, ready`, más antigua primero), `get_tables_map(uow) -> list[TableMapView]`.

- [ ] **Step 1: Write the failing tests**
  - `test_diner_menu_hides_cost_and_inactive_items` (ningún campo `cost` en las vistas serializadas con `dataclasses.asdict`).
  - `test_diner_menu_marks_unavailable_with_reason`.
  - `test_session_balance_excludes_cancelled_orders` (`balance = subtotal + tip - paid`).
  - `test_kitchen_sees_only_pending_oldest_first`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(application): read models for diner, kitchen and waiter`

---

### Task 12: Esquema de Supabase, RLS, Realtime y datos demo

**Files:**
- Create: `supabase/config.toml` (con `supabase init`), `supabase/migrations/20261022000000_core_schema.sql`, `supabase/seed.sql`
- Test: `backend/tests/integration/test_schema.py`

**Interfaces:**
- Produces: las 20 tablas de la sección "Modelo de datos" de la spec, con sus columnas, tipos, FKs, uniques e índices, más `daily_counters(day date primary key, last_number int not null)` para numerar órdenes sin carreras. Enums de Postgres: `staff_role`, `table_status`, `order_status`, `change_source`, `payment_method (mercado_pago, cash, card_terminal)`, `payment_status (pending, approved, rejected, cancelled, refunded)`, `service_call_type (call_waiter, request_bill)`, `availability_entity (menu_item, ingredient, extra)`.
- Reglas del SQL:
  - Trigger `set_updated_at()` en todas las tablas.
  - `check (quantity >= 1)`, `check (price_cents >= 0)`, `check (cost_cents >= 0)` donde aplique.
  - `alter table ... enable row level security` en todas; políticas `select` solo `to authenticated` usando `exists (select 1 from staff where id = auth.uid() and is_active)`; ninguna política para `anon` ni de escritura.
  - `alter publication supabase_realtime add table orders, dining_tables, service_calls, payments;`
  - Bucket de Storage `menu-photos` (público de lectura) para el plan 3.
  - `restaurant_settings`: una fila con `auto_release_minutes = 5`, `tip_options = '{10,15,20}'`, `timezone = 'America/Mexico_City'`, `currency = 'MXN'`.
- `seed.sql`: 6 mesas (`M1`–`M6`, `qr_token` fijos para desarrollo), 3 categorías (Bowls, Sándwiches, Jugos), 6 platillos con ingredientes removibles y esenciales, 3 extras (uno ligado al ingrediente Aguacate), y 3 usuarios en `auth.users` + `staff` (`admin@foody.local`, `cocina@foody.local`, `mesero@foody.local`, contraseña `foody1234`).

- [ ] **Step 1: Write the failing integration test** (`@pytest.mark.integration`, conecta a `DATABASE_URL` local):

```python
def test_core_tables_exist(conn):
    names = {r[0] for r in conn.execute(text("select table_name from information_schema.tables where table_schema='public'"))}
    assert {"staff", "restaurant_settings", "dining_tables", "table_sessions", "table_status_history", "categories",
            "menu_items", "ingredients", "menu_item_ingredients", "extras", "menu_item_extras", "availability_log",
            "orders", "order_items", "order_item_extras", "order_item_removed_ingredients", "order_status_history",
            "payments", "payment_webhook_events", "service_calls", "daily_counters"} <= names

def test_anon_cannot_read_orders(anon_conn):
    assert anon_conn.execute(text("select count(*) from orders")).scalar() == 0  # RLS sin política para anon

def test_quantity_check(conn):
    with pytest.raises(IntegrityError): insert_order_item(conn, quantity=0)
```

(`anon_conn` ejecuta `set local role anon`.)

- [ ] **Step 2: Run** `supabase start && supabase db reset` y luego `cd backend && uv run pytest -m integration tests/integration/test_schema.py -v` → FAIL (sin migración).
- [ ] **Step 3: Write** la migración y el seed.
- [ ] **Step 4: Run** `supabase db reset` (aplica migración + seed) y el test → PASS.
- [ ] **Step 5: Commit** `feat(db): core schema, RLS, realtime publication and seed`

---

### Task 13: Repositorios SQLAlchemy y UnitOfWork

**Files:**
- Create: `backend/app/infrastructure/db/engine.py`, `backend/app/infrastructure/db/tables.py`, `backend/app/infrastructure/db/repositories.py`, `backend/app/infrastructure/db/unit_of_work.py`, `backend/app/infrastructure/clock.py`
- Test: `backend/tests/integration/test_repositories.py`

**Interfaces:**
- Consumes: puertos (Task 7), esquema (Task 12).
- Produces: `make_engine(database_url: str) -> Engine` (`pool_pre_ping=True`); `SqlUnitOfWork(engine)` que implementa `UnitOfWork`; `SystemClock(timezone: str)`.
- Detalles fijados:
  - `get_for_update` usa `SELECT ... FOR UPDATE`.
  - `next_daily_number(day)`: `insert into daily_counters(day, last_number) values (:d, 1) on conflict (day) do update set last_number = daily_counters.last_number + 1 returning last_number`.
  - `OrderRepository.add` inserta `orders`, `order_items`, `order_item_extras` y `order_item_removed_ingredients` con los valores copiados de `PricedLine`.
  - `MenuRepository.get_items` carga platillo + ingredientes + extras (+ ingrediente del extra) en máximo 3 consultas; incluye borrados e inactivos (la regla la decide el dominio).
  - Mapeo fila ↔ entidad en funciones privadas `_row_to_*`.

- [ ] **Step 1: Write the failing integration tests** (sobre el seed, cada test en una transacción que se revierte):
  - `test_place_order_roundtrip`: `open_table` + `place_order` con `SqlUnitOfWork`; se lee la orden con sus extras y quitados iguales a lo enviado.
  - `test_concurrent_orders_get_distinct_daily_numbers`: dos hilos con su propio `SqlUnitOfWork` colocan orden en la misma mesa a la vez → dos órdenes, `daily_number` distintos, `session.subtotal_cents` igual a la suma.
  - `test_menu_repository_loads_extras_with_ingredient`.
- [ ] **Step 2: Run** `uv run pytest -m integration tests/integration/test_repositories.py -v` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS; también `uv run pytest` (unitarias) sigue verde.
- [ ] **Step 5: Commit** `feat(infra): SQLAlchemy repositories and unit of work`

---

### Task 14: Autenticación del personal

**Files:**
- Create: `backend/app/infrastructure/auth/jwt_verifier.py`, `backend/app/presentation/deps.py`
- Test: `backend/tests/api/test_auth.py`

**Interfaces:**
- Produces:
  - `JwtVerifier(supabase_url: str, jwt_secret: str | None)` con `verify(token: str) -> UUID` (devuelve `sub`). Usa JWKS de `{supabase_url}/auth/v1/.well-known/jwks.json` (`PyJWKClient`, cacheado) para tokens asimétricos y HS256 con `jwt_secret` si el header es `HS256`; `audience="authenticated"`. Token inválido o vencido → `Forbidden`.
  - `CurrentStaff(id: UUID, role: StaffRole, full_name: str)`.
  - Dependencias FastAPI: `get_uow() -> Iterator[UnitOfWork]`, `get_clock() -> Clock`, `current_staff(...) -> CurrentStaff` (lee `staff` por id; inexistente o `is_active=False` → 403), `require_roles(*roles: StaffRole)` que deja pasar siempre a `admin`.
- Respuestas: sin header `Authorization: Bearer` → 401 `{"code": "unauthorized"}`; rol no permitido → 403 `{"code": "forbidden"}`.

- [ ] **Step 1: Write the failing tests** con tokens HS256 firmados en el test y `app.dependency_overrides` para `get_uow` (InMemory con un staff `kitchen`):
  - `test_missing_token_is_401`, `test_expired_token_is_403`, `test_waiter_route_rejects_kitchen_role` (usa una ruta de prueba montada en el test con `require_roles(StaffRole.WAITER)`), `test_admin_passes_any_role_guard`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(auth): verify Supabase JWT and staff roles`

---

### Task 15: API del comensal

**Files:**
- Create: `backend/app/presentation/errors.py`, `backend/app/presentation/schemas.py`, `backend/app/presentation/routers/diner.py`
- Modify: `backend/app/main.py` (registra routers, manejadores y `slowapi`)
- Test: `backend/tests/api/test_diner_api.py`

**Interfaces:**
- Consumes: `place_order`, `get_diner_table`, `get_diner_menu`, `get_diner_session`.
- Produces rutas:
  - `GET /api/v1/diner/tables/{qr_token}` → `DinerTableView`
  - `GET /api/v1/diner/tables/{qr_token}/menu` → `list[DinerMenuCategoryView]`
  - `GET /api/v1/diner/tables/{qr_token}/session` → `DinerSessionView | null`
  - `POST /api/v1/diner/tables/{qr_token}/orders` → 201 `{"order_id", "daily_number", "round_number", "status", "subtotal_cents"}`
- `PlaceOrderIn`: `idempotency_key: UUID`, `expected_total_cents: int | None`, `lines: list[LineIn]` (1–30); `LineIn.quantity: conint(ge=1, le=50)`; `note: constr(max_length=200) | None`; `extras[].quantity: conint(ge=1, le=10)`.
- Mapeo de errores en `errors.py`: `NotFound` 404, `TableNotOpen` 403, `Forbidden` 403, `ItemUnavailable` / `PriceChanged` / `InvalidTransition` 409, `InvalidCustomization` 422; `RequestValidationError` → 422 `{"code": "validation_error", "details": {"errors": [...]}}`; todo con la forma `{"code","message","details"}`.
- Límite `10/minute` en el POST con clave `f"{qr_token}:{client_ip}"`; excedido → 429 `{"code": "rate_limited"}`.

- [ ] **Step 1: Write the failing tests** (TestClient con `InMemoryUnitOfWork` sembrado):
  - `test_get_menu_has_no_cost_fields`
  - `test_place_order_returns_201_and_daily_number`
  - `test_place_order_on_closed_table_is_403_table_not_open`
  - `test_place_order_unavailable_is_409_with_lines`
  - `test_place_order_rejects_quantity_zero` (422 `validation_error`)
  - `test_eleventh_order_in_a_minute_is_429`
- [ ] **Step 2: Run** `uv run pytest tests/api/test_diner_api.py -v` → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): diner endpoints with error mapping and rate limit`

---

### Task 16: API de cocina y mesero

**Files:**
- Create: `backend/app/presentation/routers/kitchen.py`, `backend/app/presentation/routers/waiter.py`
- Modify: `backend/app/presentation/schemas.py`, `backend/app/main.py`
- Test: `backend/tests/api/test_staff_api.py`

**Interfaces:**
- Consumes: casos de uso de Tasks 8, 10 y 11; `require_roles` (Task 14).
- Produces rutas (todas con `Authorization: Bearer`):
  - `GET /api/v1/kitchen/orders?status=active` (kitchen) → `list[KitchenOrderView]`
  - `POST /api/v1/kitchen/orders/{id}/status` body `{"status": "preparing" | "ready"}` (kitchen)
  - `GET /api/v1/waiter/tables` (waiter) → `list[TableMapView]`
  - `POST /api/v1/waiter/tables/{id}/open` body `{"guests_count": int | null}` (waiter) → `{"session_id"}`
  - `POST /api/v1/waiter/tables/{id}/reopen` (waiter) → `{"session_id"}`
  - `POST /api/v1/waiter/tables/{id}/release` (waiter)
  - `POST /api/v1/waiter/orders/{id}/served` (waiter)
  - `POST /api/v1/waiter/orders/{id}/cancel` body `{"reason": str (1–200)}` (waiter)

- [ ] **Step 1: Write the failing tests**: flujo completo con tokens de prueba: mesero abre M1 → comensal ordena → cocina `preparing` y `ready` → mesero `served` → `GET /waiter/tables` muestra M1 `served`; `test_kitchen_token_cannot_open_table` (403); `test_ready_twice_is_409`.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement.** **Step 4: Run** → PASS.
- [ ] **Step 5: Commit** `feat(api): kitchen and waiter endpoints`

---

### Task 17: Liberación automática y arranque local

**Files:**
- Create: `backend/app/infrastructure/scheduler.py`, `backend/README.md`
- Modify: `backend/app/main.py` (lifespan), `backend/.env.example`
- Test: `backend/tests/api/test_scheduler.py`

**Interfaces:**
- Consumes: `release_expired_tables` (Task 8).
- Produces: `run_release_job(uow_factory: Callable[[], UnitOfWork], clock: Clock, read_minutes: Callable[[UnitOfWork], int]) -> int` (lee `restaurant_settings.auto_release_minutes`, llama al caso de uso, registra el conteo en log) y `start_scheduler(app_state) -> BackgroundScheduler` (cada 60 s) arrancado en el `lifespan` solo si `settings.enable_scheduler`.

- [ ] **Step 1: Write the failing test** `test_run_release_job_frees_expired_tables` con `InMemoryUnitOfWork` y `FixedClock` (una mesa cerrada hace 6 min, ajuste en 5) → devuelve 1.
- [ ] **Step 2: Run** → FAIL. **Step 3: Implement** y escribe `README.md` con: `supabase start`, `supabase db reset`, copiar `.env.example` a `.env`, `uv run uvicorn app.main:create_app --factory --reload`, cómo correr unitarias e integración, y los usuarios demo del seed.
- [ ] **Step 4: Run** `uv run pytest` (todo lo no-integración) → PASS; `uv run pytest -m integration` con Supabase local → PASS; `uv run ruff check .` limpio.
- [ ] **Step 5: Commit** `feat: auto-release closed tables and local run guide`

---

## Self-review

- **Cobertura de la spec en este plan:** objetivo (orden en cocina vía Realtime: la publicación queda lista en Task 12; la pantalla es el plan 5), modelo de datos completo (Task 12), disponibilidad (3, 4, 11), estados de mesa y orden (5, 6, 8, 10), flujo de abrir mesa y ordenar (8, 9, 15, 16), liberación (8, 17), API del comensal, cocina y mesero (15, 16), errores e idempotencia (9, 10, 15), seguridad: RLS, límite y JWT (12, 14, 15). Pagos, avisos, admin, dashboard y frontend quedan en los planes 2 a 5 según el roadmap.
- **Desviaciones conscientes de la spec:** migraciones en `supabase/migrations/` (no en `infrastructure/db`) porque la CLI las aplica de ahí; tabla extra `daily_counters` para que `daily_number` no tenga carreras.
- **Tipos:** `LineRequest`, `PricedLine`, `PlaceOrderCommand`, `StatusChange` y los nombres de repositorios se usan igual en Tasks 4, 7, 9, 10 y 13.
