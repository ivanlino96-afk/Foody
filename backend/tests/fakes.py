import copy
from collections.abc import Iterable
from dataclasses import dataclass, field
from datetime import date, datetime, timedelta
from uuid import UUID, uuid4
from zoneinfo import ZoneInfo

from app.application.dto import MenuCategoryView, StaffMember
from app.domain.entities import (
    DiningTable,
    Extra,
    Ingredient,
    ItemExtra,
    ItemIngredient,
    MenuItem,
    Order,
    Payment,
    ServiceCall,
    StatusChange,
    TableSession,
)
from app.domain.enums import OrderStatus, StaffRole, TableStatus


def make_ingredient(name: str = "Cebolla", available: bool = True) -> Ingredient:
    return Ingredient(id=uuid4(), name=name, is_available=available)


def make_extra(name: str = "Queso extra", price_cents: int = 2000, cost_cents: int = 500, available: bool = True,
               ingredient: Ingredient | None = None) -> Extra:
    return Extra(id=uuid4(), name=name, price_cents=price_cents, cost_cents=cost_cents, is_available=available,
                 ingredient=ingredient)


def make_item(name: str = "Taco", price_cents: int = 4000, cost_cents: int = 1500, is_available: bool = True,
              is_active: bool = True, is_deleted: bool = False, ingredients: list[ItemIngredient] | None = None,
              extras: list[ItemExtra] | None = None, category_id=None) -> MenuItem:
    return MenuItem(id=uuid4(), category_id=category_id or uuid4(), name=name, price_cents=price_cents,
                    cost_cents=cost_cents, is_available=is_available, is_active=is_active, is_deleted=is_deleted,
                    ingredients=tuple(ingredients or ()), extras=tuple(extras or ()))

# --- In-memory unit of work -------------------------------------------------


T0 = datetime(2026, 10, 22, 18, 0, tzinfo=ZoneInfo("UTC"))


@dataclass
class FixedClock:
    current: datetime = T0
    timezone: str = "America/Mexico_City"

    @classmethod
    def at(cls, iso: str) -> "FixedClock":
        return cls(datetime.fromisoformat(iso))

    def now(self) -> datetime:
        return self.current

    def business_date(self) -> date:
        return self.current.astimezone(ZoneInfo(self.timezone)).date()

    def advance(self, **kwargs: float) -> None:
        self.current += timedelta(**kwargs)


def make_table(code: str = "M1", status: TableStatus = TableStatus.FREE, qr_token: str | None = None,
               changed_at: datetime = T0) -> DiningTable:
    return DiningTable(id=uuid4(), code=code, label=None, zone=None, capacity=4, qr_token=qr_token or f"qr-{code}",
                       status=status, current_session_id=None, status_changed_at=changed_at)


@dataclass
class _State:
    tables: dict[UUID, DiningTable] = field(default_factory=dict)
    sessions: dict[UUID, TableSession] = field(default_factory=dict)
    items: dict[UUID, object] = field(default_factory=dict)
    categories: list[tuple[UUID, str]] = field(default_factory=list)
    orders: dict[UUID, Order] = field(default_factory=dict)
    table_history: list[StatusChange] = field(default_factory=list)
    order_history: list[StatusChange] = field(default_factory=list)
    staff: dict[UUID, StaffMember] = field(default_factory=dict)
    daily: dict[date, int] = field(default_factory=dict)
    auto_release_minutes: int = 5
    service_calls: dict[UUID, ServiceCall] = field(default_factory=dict)
    payments: dict[UUID, Payment] = field(default_factory=dict)
    availability: dict[tuple, bool] = field(default_factory=dict)
    availability_log: list[tuple] = field(default_factory=list)


class _Tables:
    def __init__(self, uow: "InMemoryUnitOfWork") -> None:
        self._uow = uow

    def get(self, table_id):
        return self._uow.state.tables.get(table_id)

    def get_by_qr(self, qr_token):
        return next((t for t in self._uow.state.tables.values() if t.qr_token == qr_token), None)

    get_for_update = get

    def list_active(self):
        return sorted(self._uow.state.tables.values(), key=lambda t: t.code)

    def list_by_status(self, status):
        return [t for t in self.list_active() if t.status == status]

    def save(self, table):
        self._uow.state.tables[table.id] = table


class _Sessions:
    def __init__(self, uow: "InMemoryUnitOfWork") -> None:
        self._uow = uow

    def get(self, session_id):
        return self._uow.state.sessions.get(session_id)

    get_for_update = get

    def add(self, session):
        self._uow.state.sessions[session.id] = session

    save = add


class _Menu:
    def __init__(self, uow: "InMemoryUnitOfWork") -> None:
        self._uow = uow

    def get_items(self, ids: Iterable[UUID]):
        return {i: self._uow.state.items[i] for i in ids if i in self._uow.state.items}

    def list_menu(self):
        return [MenuCategoryView(cid, name, [i for i in self._uow.state.items.values() if i.category_id == cid])
                for cid, name in self._uow.state.categories]


class _Orders:
    def __init__(self, uow: "InMemoryUnitOfWork") -> None:
        self._uow = uow

    def get(self, order_id):
        return self._uow.state.orders.get(order_id)

    get_for_update = get

    def get_by_idempotency_key(self, key):
        return next((o for o in self._uow.state.orders.values() if o.idempotency_key == key), None)

    def add(self, order):
        self._uow.state.orders[order.id] = order

    save = add

    def list_by_session(self, session_id):
        return sorted((o for o in self._uow.state.orders.values() if o.session_id == session_id),
                      key=lambda o: o.round_number)

    def list_by_status(self, statuses: Iterable[OrderStatus]):
        wanted = set(statuses)
        return sorted((o for o in self._uow.state.orders.values() if o.status in wanted), key=lambda o: o.created_at)

    def next_round_number(self, session_id):
        return len(self.list_by_session(session_id)) + 1

    def next_daily_number(self, day):
        self._uow.state.daily[day] = self._uow.state.daily.get(day, 0) + 1
        return self._uow.state.daily[day]


class _History:
    def __init__(self, uow: "InMemoryUnitOfWork") -> None:
        self._uow = uow

    def add_table_change(self, change):
        self._uow.state.table_history.append(change)

    def add_order_change(self, change):
        self._uow.state.order_history.append(change)


class _Staff:
    def __init__(self, uow: "InMemoryUnitOfWork") -> None:
        self._uow = uow

    def get(self, staff_id):
        return self._uow.state.staff.get(staff_id)


class _Settings:
    def __init__(self, uow: "InMemoryUnitOfWork") -> None:
        self._uow = uow

    def auto_release_minutes(self):
        return self._uow.state.auto_release_minutes


class _ServiceCalls:
    def __init__(self, uow: "InMemoryUnitOfWork") -> None:
        self._uow = uow

    def add(self, call):
        self._uow.state.service_calls[call.id] = call

    save = add

    def get_for_update(self, call_id):
        return self._uow.state.service_calls.get(call_id)

    def pending_for_session(self, session_id, call_type):
        return next((c for c in self._uow.state.service_calls.values()
                     if c.session_id == session_id and c.type == call_type and c.attended_at is None), None)

    def list_pending(self):
        return sorted((c for c in self._uow.state.service_calls.values() if c.attended_at is None),
                      key=lambda c: c.created_at)


class _Payments:
    def __init__(self, uow: "InMemoryUnitOfWork") -> None:
        self._uow = uow

    def add(self, payment):
        self._uow.state.payments[payment.id] = payment

    def list_by_session(self, session_id):
        return sorted((p for p in self._uow.state.payments.values() if p.session_id == session_id),
                      key=lambda p: p.created_at)


class _Availability:
    def __init__(self, uow: "InMemoryUnitOfWork") -> None:
        self._uow = uow

    def set_available(self, entity, entity_id, is_available, staff_id):
        if (entity, entity_id) not in self._uow.state.availability:
            return False
        self._uow.state.availability[(entity, entity_id)] = is_available
        return True

    def add_log(self, entity, entity_id, is_available, staff_id, at):
        self._uow.state.availability_log.append((entity, entity_id, is_available, staff_id, at))

    def list_board(self):
        raise NotImplementedError("board is SQL-only")


class InMemoryUnitOfWork:
    def __init__(self) -> None:
        self.state = _State()
        self.commits = 0
        self._snapshot: _State | None = None
        self.tables = _Tables(self)
        self.sessions = _Sessions(self)
        self.menu = _Menu(self)
        self.orders = _Orders(self)
        self.history = _History(self)
        self.staff = _Staff(self)
        self.settings = _Settings(self)
        self.service_calls = _ServiceCalls(self)
        self.payments = _Payments(self)
        self.availability = _Availability(self)

    def __enter__(self):
        self._snapshot = copy.deepcopy(self.state)
        return self

    def __exit__(self, *exc):
        self.rollback()

    def commit(self):
        self.commits += 1
        self._snapshot = copy.deepcopy(self.state)

    def rollback(self):
        if self._snapshot is not None:
            self.state = self._snapshot
            self._snapshot = None

    # seeding helpers (outside a transaction)
    def seed_table(self, **kwargs) -> DiningTable:
        table = make_table(**kwargs)
        self.state.tables[table.id] = table
        return table

    def seed_item(self, item, category_name: str = "Tacos"):
        if not any(cid == item.category_id for cid, _ in self.state.categories):
            self.state.categories.append((item.category_id, category_name))
        self.state.items[item.id] = item
        return item

    def seed_staff(self, role: StaffRole, active: bool = True) -> StaffMember:
        member = StaffMember(uuid4(), f"{role.value} user", role, active)
        self.state.staff[member.id] = member
        return member
