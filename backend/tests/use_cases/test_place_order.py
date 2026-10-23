from uuid import uuid4

import pytest

from app.application.use_cases.place_order import PlaceOrderCommand, place_order
from app.application.use_cases.tables import open_table
from app.domain.enums import ChangeSource, OrderStatus, TableStatus
from app.domain.errors import ItemUnavailable, NotFound, PriceChanged, TableNotOpen
from app.domain.services.pricing import LineRequest
from tests.fakes import FixedClock, InMemoryUnitOfWork, make_item


def setup(status_after_open: TableStatus | None = None):
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    table = uow.seed_table(code="M5", qr_token="qr-m5")
    taco = uow.seed_item(make_item("Taco", price_cents=4000, cost_cents=1500))
    session = open_table(uow, clock, table.id, uuid4())
    if status_after_open:
        uow.state.tables[table.id].status = status_after_open
    return uow, clock, table, taco, session


def cmd(item, qty=2, key=None, expected=None):
    return PlaceOrderCommand("qr-m5", key or uuid4(), (LineRequest(item.id, qty),), expected)


def test_places_order_and_updates_session_and_table():
    uow, clock, table, taco, session = setup()
    order = place_order(uow, clock, cmd(taco))
    assert (order.status, order.round_number, order.daily_number) == (OrderStatus.RECEIVED, 1, 1)
    assert order.subtotal_cents == 8000 and order.cost_cents == 3000
    saved = uow.sessions.get(session.id)
    assert (saved.subtotal_cents, saved.cost_cents) == (8000, 3000)
    assert uow.tables.get(table.id).status == TableStatus.AWAITING_ORDER
    [history] = uow.state.order_history
    assert (history.from_status, history.to_status, history.source) == (None, "received", ChangeSource.DINER)
    assert uow.state.table_history[-1].source == ChangeSource.DINER


def test_second_round_after_served():
    uow, clock, table, taco, _ = setup()
    place_order(uow, clock, cmd(taco))
    uow.state.tables[table.id].status = TableStatus.SERVED
    second = place_order(uow, clock, cmd(taco))
    assert (second.round_number, second.daily_number) == (2, 2)
    assert uow.tables.get(table.id).status == TableStatus.AWAITING_ORDER


def test_same_idempotency_key_returns_same_order():
    uow, clock, _, taco, session = setup()
    key = uuid4()
    first = place_order(uow, clock, cmd(taco, key=key))
    again = place_order(uow, clock, cmd(taco, key=key))
    assert again.id == first.id
    assert len(uow.state.orders) == 1
    assert uow.sessions.get(session.id).subtotal_cents == 8000


@pytest.mark.parametrize("status", [TableStatus.BILL_REQUESTED, TableStatus.CLOSED, TableStatus.FREE])
def test_cannot_order_when_bill_requested(status):
    uow, clock, _, taco, _ = setup(status)
    with pytest.raises(TableNotOpen):
        place_order(uow, clock, cmd(taco))
    assert uow.state.orders == {}


def test_unknown_qr_is_not_found():
    uow, clock, _, taco, _ = setup()
    with pytest.raises(NotFound):
        place_order(uow, clock, PlaceOrderCommand("nope", uuid4(), (LineRequest(taco.id, 1),), None))


def test_price_changed_when_expected_total_differs():
    uow, clock, _, taco, _ = setup()
    with pytest.raises(PriceChanged) as e:
        place_order(uow, clock, cmd(taco, expected=8000 - 100))
    assert e.value.details == {"total_cents": 8000}
    assert uow.state.orders == {}


def test_expected_total_matching_is_accepted():
    uow, clock, _, taco, _ = setup()
    assert place_order(uow, clock, cmd(taco, expected=8000)).subtotal_cents == 8000


def test_unavailable_item_rolls_back():
    uow, clock, _, _, session = setup()
    off = uow.seed_item(make_item("Agotado", is_available=False))
    with pytest.raises(ItemUnavailable):
        place_order(uow, clock, cmd(off))
    assert uow.sessions.get(session.id).subtotal_cents == 0
    assert uow.state.orders == {}
