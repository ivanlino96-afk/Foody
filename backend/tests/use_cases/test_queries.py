import dataclasses
import json
from uuid import uuid4

from app.application.use_cases.advance_order import advance_order, cancel_order
from app.application.use_cases.place_order import PlaceOrderCommand, place_order
from app.application.use_cases.queries import (
    get_active_orders,
    get_diner_menu,
    get_diner_session,
    get_diner_table,
    get_tables_map,
)
from app.application.use_cases.tables import open_table
from app.domain.entities import ItemExtra, ItemIngredient
from app.domain.enums import OrderStatus, StaffRole, TableStatus
from app.domain.services.pricing import ExtraRequest, LineRequest
from tests.fakes import FixedClock, InMemoryUnitOfWork, make_extra, make_ingredient, make_item

WAITER = uuid4()


def seeded():
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    table = uow.seed_table(code="M5", qr_token="qr")
    cebolla = make_ingredient("Cebolla", available=False)
    queso = make_extra("Queso", price_cents=1500)
    taco = uow.seed_item(make_item("Taco", ingredients=[ItemIngredient(cebolla, True)], extras=[ItemExtra(queso)]))
    return uow, clock, table, taco, queso, cebolla


def order(uow, clock, item, extras=()):
    return place_order(uow, clock, PlaceOrderCommand("qr", uuid4(), (LineRequest(item.id, 1, extras=extras),), None))


def test_diner_table_says_if_can_order():
    uow, clock, table, *_ = seeded()
    assert get_diner_table(uow, "qr").can_order is False
    open_table(uow, clock, table.id, WAITER)
    view = get_diner_table(uow, "qr")
    assert (view.code, view.status, view.can_order) == ("M5", TableStatus.OCCUPIED, True)


def test_diner_menu_hides_cost_and_inactive_items():
    uow, *_ = seeded()
    uow.seed_item(make_item("Oculto", is_active=False))
    uow.seed_item(make_item("Borrado", is_deleted=True))
    menu = get_diner_menu(uow)
    names = [i.name for c in menu for i in c.items]
    assert names == ["Taco"]
    assert "cost" not in json.dumps([dataclasses.asdict(c) for c in menu], default=str)


def test_diner_menu_marks_unavailable_with_reason():
    uow, *_ = seeded()
    uow.seed_item(make_item("Agotado", is_available=False))
    items = {i.name: i for c in get_diner_menu(uow) for i in c.items}
    assert (items["Agotado"].available, items["Agotado"].unavailable_reason) == (False, "item_disabled")
    taco = items["Taco"]
    assert taco.available is True
    assert [(i.name, i.available) for i in taco.ingredients] == [("Cebolla", False)]
    assert [(e.name, e.price_cents, e.available) for e in taco.extras] == [("Queso", 1500, True)]


def test_session_balance_excludes_cancelled_orders():
    uow, clock, table, taco, queso, _ = seeded()
    assert get_diner_session(uow, "qr") is None
    open_table(uow, clock, table.id, WAITER)
    kept = order(uow, clock, taco, (ExtraRequest(queso.id),))
    dropped = order(uow, clock, taco)
    cancel_order(uow, clock, dropped.id, WAITER, StaffRole.WAITER, "error")
    view = get_diner_session(uow, "qr")
    assert view.subtotal_cents == kept.subtotal_cents == 5500
    assert view.balance_cents == 5500
    assert [r.status for r in view.rounds] == [OrderStatus.RECEIVED, OrderStatus.CANCELLED]
    line = view.rounds[0].lines[0]
    assert (line.item_name, line.extras, line.removed) == ("Taco", ["Queso"], ["Cebolla"])


def test_kitchen_sees_only_pending_oldest_first():
    uow, clock, table, taco, *_ = seeded()
    open_table(uow, clock, table.id, WAITER)
    first = order(uow, clock, taco)
    clock.advance(minutes=1)
    second = order(uow, clock, taco)
    clock.advance(minutes=1)
    third = order(uow, clock, taco)
    advance_order(uow, clock, first.id, OrderStatus.PREPARING, WAITER, StaffRole.ADMIN)
    advance_order(uow, clock, first.id, OrderStatus.READY, WAITER, StaffRole.ADMIN)
    advance_order(uow, clock, first.id, OrderStatus.SERVED, WAITER, StaffRole.ADMIN)
    cancel_order(uow, clock, third.id, WAITER, StaffRole.WAITER, "x")
    active = get_active_orders(uow)
    assert [(o.id, o.table_code, o.daily_number) for o in active] == [(second.id, "M5", 2)]


def test_tables_map_counts_pending_and_ready():
    uow, clock, table, taco, *_ = seeded()
    uow.seed_table(code="M6", qr_token="qr6")
    open_table(uow, clock, table.id, WAITER)
    a = order(uow, clock, taco)
    order(uow, clock, taco)
    advance_order(uow, clock, a.id, OrderStatus.PREPARING, WAITER, StaffRole.ADMIN)
    advance_order(uow, clock, a.id, OrderStatus.READY, WAITER, StaffRole.ADMIN)
    m5, m6 = get_tables_map(uow)
    assert (m5.code, m5.status, m5.pending_orders, m5.ready_orders) == ("M5", TableStatus.AWAITING_ORDER, 1, 1)
    assert (m6.code, m6.pending_orders, m6.ready_orders) == ("M6", 0, 0)
