from uuid import UUID, uuid4

import pytest
from sqlalchemy import text

from app.application.use_cases.availability import get_availability_board, set_availability
from app.application.use_cases.payments import register_manual_payment
from app.application.use_cases.place_order import PlaceOrderCommand, place_order
from app.application.use_cases.service_calls import request_service_call
from app.application.use_cases.tables import open_table
from app.domain.enums import AvailabilityEntity, PaymentMethod, ServiceCallType, TableStatus
from app.domain.errors import ItemUnavailable
from app.domain.services.pricing import ExtraRequest, LineRequest
from app.infrastructure.clock import SystemClock
from app.infrastructure.db.unit_of_work import SqlUnitOfWork

pytestmark = pytest.mark.integration

WAITER = UUID("33333333-3333-3333-3333-333333333333")
BOWL = UUID("cccccccc-0000-0000-0000-000000000001")
JUGO = UUID("cccccccc-0000-0000-0000-000000000005")
HUEVO = UUID("dddddddd-0000-0000-0000-000000000002")
JUGOS = UUID("aaaaaaaa-0000-0000-0000-000000000003")
QR = "dev-qr-m3-000000000000000000000000"
CLOCK = SystemClock("America/Mexico_City")


@pytest.fixture
def uow(engine):
    yield SqlUnitOfWork(engine)
    with engine.begin() as c:
        c.execute(text("update dining_tables set status = 'free', current_session_id = null; "
                       "update extras set deleted_at = null; update categories set is_active = true; "
                       "update menu_items set is_available = true; "
                       "delete from availability_log; delete from service_calls; delete from payments; "
                       "delete from order_status_history; delete from table_status_history; delete from orders; "
                       "delete from table_sessions; delete from daily_counters"))


def open_m3(uow):
    with uow:
        table_id = uow.tables.get_by_qr(QR).id
    return open_table(uow, CLOCK, table_id, WAITER)


def test_bill_and_payment_roundtrip(uow):
    session = open_m3(uow)
    place_order(uow, CLOCK, PlaceOrderCommand(QR, uuid4(), (LineRequest(BOWL, 1),), None))
    request_service_call(uow, CLOCK, QR, ServiceCallType.REQUEST_BILL)
    request_service_call(uow, CLOCK, QR, ServiceCallType.REQUEST_BILL)
    register_manual_payment(uow, CLOCK, session.id, PaymentMethod.CASH, 16500, 1000, WAITER)
    with uow:
        assert uow.tables.get_by_qr(QR).status == TableStatus.CLOSED
        saved = uow.sessions.get(session.id)
        assert (saved.paid_cents, saved.tip_cents) == (17500, 1000)
        assert saved.bill_requested_at is not None and saved.paid_at is not None
        [payment] = uow.payments.list_by_session(session.id)
        assert (payment.method, payment.amount_cents) == (PaymentMethod.CASH, 16500)
        assert uow.service_calls.list_pending() == []


def test_availability_log_row_written(uow, engine):
    set_availability(uow, CLOCK, AvailabilityEntity.MENU_ITEM, JUGO, False, WAITER)
    with engine.connect() as c:
        rows = c.execute(text("select entity_type, is_available, changed_by from availability_log")).all()
    assert [(r.entity_type, r.is_available, r.changed_by) for r in rows] == [("menu_item", False, WAITER)]
    board = get_availability_board(uow)
    assert next(r for r in board.items if r.id == JUGO).is_available is False
    quinoa = next(r for r in board.ingredients if r.name == "Quinoa")
    assert quinoa.used_in == 2


def test_deleted_extra_and_hidden_category_are_not_orderable(uow, engine):
    open_m3(uow)
    with engine.begin() as c:
        c.execute(text("update extras set deleted_at = now() where id = :e"), {"e": HUEVO})
        c.execute(text("update categories set is_active = false where id = :c"), {"c": JUGOS})
    for line in (LineRequest(BOWL, 1, extras=(ExtraRequest(HUEVO, 1),)), LineRequest(JUGO, 1)):
        with pytest.raises(ItemUnavailable):
            place_order(uow, CLOCK, PlaceOrderCommand(QR, uuid4(), (line,), None))
