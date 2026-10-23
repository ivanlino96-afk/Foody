from uuid import uuid4

import pytest

from app.application.use_cases.advance_order import advance_order, cancel_order
from app.application.use_cases.payments import register_manual_payment
from app.application.use_cases.place_order import PlaceOrderCommand, place_order
from app.application.use_cases.service_calls import request_bill_by_staff, request_service_call
from app.application.use_cases.tables import open_table
from app.domain.enums import ChangeSource, OrderStatus, PaymentMethod, ServiceCallType, StaffRole, TableStatus
from app.domain.errors import InvalidCustomization, InvalidTransition
from app.domain.services.pricing import LineRequest
from tests.fakes import FixedClock, InMemoryUnitOfWork, make_item

QR = "qr-m8"
WAITER = uuid4()


def setup():
    """Open table with one 10000-cent order."""
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    table = uow.seed_table(code="M8", qr_token=QR)
    item = uow.seed_item(make_item(price_cents=10000, cost_cents=3000))
    session = open_table(uow, clock, table.id, WAITER)
    order = place_order(uow, clock, PlaceOrderCommand(QR, uuid4(), (LineRequest(item.id, 1),), None))
    return uow, clock, table, session, order


def pay(uow, clock, session, amount, tip=0, method=PaymentMethod.CASH):
    return register_manual_payment(uow, clock, session.id, method, amount, tip, WAITER)


def test_cash_payment_closes_table():
    uow, clock, table, session, _ = setup()
    request_service_call(uow, clock, QR, ServiceCallType.REQUEST_BILL)
    payment = pay(uow, clock, session, 10000, 1500)
    assert (payment.amount_cents, payment.tip_cents, payment.received_by) == (10000, 1500, WAITER)
    assert uow.state.tables[table.id].status == TableStatus.CLOSED
    assert uow.state.table_history[-1].source == ChangeSource.PAYMENT
    saved = uow.state.sessions[session.id]
    assert (saved.paid_cents, saved.tip_cents, saved.paid_at) == (11500, 1500, clock.now())
    assert all(c.attended_at is not None for c in uow.state.service_calls.values())


def test_split_payment_closes_on_second():
    uow, clock, table, session, _ = setup()
    request_service_call(uow, clock, QR, ServiceCallType.REQUEST_BILL)
    pay(uow, clock, session, 6000)
    assert uow.state.tables[table.id].status == TableStatus.BILL_REQUESTED
    pay(uow, clock, session, 4000, 500, PaymentMethod.CARD_TERMINAL)
    assert uow.state.tables[table.id].status == TableStatus.CLOSED
    assert len(uow.state.payments) == 2


def test_payment_over_balance_is_rejected():
    uow, clock, table, session, _ = setup()
    with pytest.raises(InvalidCustomization):
        pay(uow, clock, session, 10001)
    assert uow.state.payments == {}
    assert uow.state.tables[table.id].status == TableStatus.AWAITING_ORDER


def test_waiter_payment_from_served_requests_bill_first():
    uow, clock, _, session, order = setup()
    for target, role in ((OrderStatus.PREPARING, StaffRole.KITCHEN), (OrderStatus.READY, StaffRole.KITCHEN),
                         (OrderStatus.SERVED, StaffRole.WAITER)):
        advance_order(uow, clock, order.id, target, WAITER, role)
    pay(uow, clock, session, 10000)
    steps = [(h.from_status, h.to_status) for h in uow.state.table_history[-2:]]
    assert steps == [("served", "bill_requested"), ("bill_requested", "closed")]


def test_mercado_pago_method_is_rejected_for_manual():
    uow, clock, _, session, _ = setup()
    with pytest.raises(InvalidCustomization):
        pay(uow, clock, session, 10000, method=PaymentMethod.MERCADO_PAGO)


def test_cannot_cancel_after_session_closed():
    uow, clock, _, session, order = setup()
    pay(uow, clock, session, 10000)
    with pytest.raises(InvalidTransition):
        cancel_order(uow, clock, order.id, WAITER, StaffRole.WAITER, "tarde")
    assert uow.state.sessions[session.id].subtotal_cents == 10000


def test_cannot_pay_closed_session():
    uow, clock, _, session, _ = setup()
    pay(uow, clock, session, 10000)
    with pytest.raises(InvalidTransition):
        pay(uow, clock, session, 1)


def test_request_bill_on_empty_account_is_rejected():
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    table = uow.seed_table(code="M9", qr_token="qr-m9")
    open_table(uow, clock, table.id, WAITER)
    with pytest.raises(InvalidTransition):
        request_service_call(uow, clock, "qr-m9", ServiceCallType.REQUEST_BILL)
    with pytest.raises(InvalidTransition):
        request_bill_by_staff(uow, clock, table.id, WAITER)
    assert uow.state.tables[table.id].status == TableStatus.OCCUPIED


def test_cannot_cancel_below_what_was_already_paid():
    uow, clock, _, session, _ = setup()
    item = next(iter(uow.state.items.values()))
    second = place_order(uow, clock, PlaceOrderCommand(QR, uuid4(), (LineRequest(item.id, 1),), None))
    pay(uow, clock, session, 15000)
    with pytest.raises(InvalidTransition):
        cancel_order(uow, clock, second.id, WAITER, StaffRole.WAITER, "tarde")
    assert uow.state.sessions[session.id].subtotal_cents == 20000


def test_cancel_that_leaves_nothing_to_pay_closes_the_table():
    uow, clock, table, session, _ = setup()
    item = next(iter(uow.state.items.values()))
    second = place_order(uow, clock, PlaceOrderCommand(QR, uuid4(), (LineRequest(item.id, 1),), None))
    pay(uow, clock, session, 10000)
    cancel_order(uow, clock, second.id, WAITER, StaffRole.WAITER, "no llegó")
    assert uow.state.tables[table.id].status == TableStatus.CLOSED
    assert uow.state.sessions[session.id].paid_at == clock.now()


def test_settling_attends_every_pending_call():
    uow, clock, _, session, _ = setup()
    request_service_call(uow, clock, QR, ServiceCallType.CALL_WAITER)
    pay(uow, clock, session, 10000)
    assert all(c.attended_at is not None for c in uow.state.service_calls.values())
