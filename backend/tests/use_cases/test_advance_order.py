from uuid import uuid4

import pytest

from app.application.use_cases.advance_order import advance_order, cancel_order
from app.application.use_cases.place_order import PlaceOrderCommand, place_order
from app.application.use_cases.tables import open_table
from app.domain.enums import OrderStatus as O
from app.domain.enums import StaffRole as R
from app.domain.enums import TableStatus
from app.domain.errors import Forbidden, InvalidCustomization, InvalidTransition
from app.domain.services.pricing import LineRequest
from tests.fakes import FixedClock, InMemoryUnitOfWork, make_item

COOK, WAITER = uuid4(), uuid4()


def setup(orders: int = 1):
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    table = uow.seed_table(qr_token="qr")
    taco = uow.seed_item(make_item(price_cents=4000, cost_cents=1000))
    session = open_table(uow, clock, table.id, WAITER)
    placed = [place_order(uow, clock, PlaceOrderCommand("qr", uuid4(), (LineRequest(taco.id, 1),), None))
              for _ in range(orders)]
    return uow, clock, table, session, placed


def to_ready(uow, clock, order_id):
    advance_order(uow, clock, order_id, O.PREPARING, COOK, R.KITCHEN)
    return advance_order(uow, clock, order_id, O.READY, COOK, R.KITCHEN)


def test_kitchen_moves_to_preparing_and_ready_with_timestamps():
    uow, clock, _, _, [order] = setup()
    prep = advance_order(uow, clock, order.id, O.PREPARING, COOK, R.KITCHEN)
    assert prep.status == O.PREPARING and prep.preparing_at == clock.now()
    clock.advance(minutes=7)
    ready = advance_order(uow, clock, order.id, O.READY, COOK, R.KITCHEN)
    assert ready.status == O.READY and ready.ready_at == clock.now()


def test_double_ready_is_rejected_without_history():
    uow, clock, _, _, [order] = setup()
    to_ready(uow, clock, order.id)
    with pytest.raises(InvalidTransition):
        advance_order(uow, clock, order.id, O.READY, COOK, R.KITCHEN)
    statuses = [c.to_status for c in uow.state.order_history if c.entity_id == order.id]
    assert statuses == ["received", "preparing", "ready"]


def test_serving_last_pending_order_marks_table_served():
    uow, clock, table, _, [first, second] = setup(orders=2)
    for o in (first, second):
        to_ready(uow, clock, o.id)
    served = advance_order(uow, clock, first.id, O.SERVED, WAITER, R.WAITER)
    assert served.served_at == clock.now()
    assert uow.tables.get(table.id).status == TableStatus.AWAITING_ORDER
    advance_order(uow, clock, second.id, O.SERVED, WAITER, R.WAITER)
    assert uow.tables.get(table.id).status == TableStatus.SERVED


def test_cancel_subtracts_from_session_and_can_finish_round():
    uow, clock, table, session, [order] = setup()
    cancelled = cancel_order(uow, clock, order.id, WAITER, R.WAITER, "El cliente cambió de opinión")
    assert (cancelled.status, cancelled.cancelled_by, cancelled.cancel_reason) == (
        O.CANCELLED, WAITER, "El cliente cambió de opinión")
    saved = uow.sessions.get(session.id)
    assert (saved.subtotal_cents, saved.cost_cents) == (0, 0)
    assert uow.tables.get(table.id).status == TableStatus.SERVED


def test_cancel_requires_reason():
    uow, clock, _, _, [order] = setup()
    with pytest.raises(InvalidCustomization):
        cancel_order(uow, clock, order.id, WAITER, R.WAITER, "  ")


def test_kitchen_cannot_cancel():
    uow, clock, _, _, [order] = setup()
    with pytest.raises(Forbidden):
        cancel_order(uow, clock, order.id, COOK, R.KITCHEN, "no")
