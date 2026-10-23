from uuid import uuid4

import pytest

from app.application.use_cases.place_order import PlaceOrderCommand, place_order
from app.application.use_cases.queries import get_diner_session
from app.application.use_cases.service_calls import attend_service_call, list_pending_calls, request_service_call
from app.application.use_cases.tables import open_table
from app.domain.enums import ChangeSource, ServiceCallType, TableStatus
from app.domain.errors import InvalidTransition, TableNotOpen
from app.domain.services.pricing import LineRequest
from tests.fakes import FixedClock, InMemoryUnitOfWork, make_item

QR = "qr-m7"


def setup(open_: bool = True):
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    table = uow.seed_table(code="M7", qr_token=QR)
    if open_:
        open_table(uow, clock, table.id, uuid4())
    return uow, clock, table


def test_call_waiter_creates_pending_call():
    uow, clock, table = setup()
    call = request_service_call(uow, clock, QR, ServiceCallType.CALL_WAITER)
    assert call.attended_at is None and call.table_id == table.id
    assert [(v.table_code, v.type) for v in list_pending_calls(uow)] == [("M7", ServiceCallType.CALL_WAITER)]
    assert uow.state.tables[table.id].status == TableStatus.OCCUPIED


def test_request_bill_moves_table_to_bill_requested():
    uow, clock, table = setup()
    request_service_call(uow, clock, QR, ServiceCallType.REQUEST_BILL)
    saved = uow.state.tables[table.id]
    assert saved.status == TableStatus.BILL_REQUESTED
    last = uow.state.table_history[-1]
    assert (last.to_status, last.source) == ("bill_requested", ChangeSource.DINER)
    assert uow.state.sessions[saved.current_session_id].bill_requested_at == clock.now()


def test_request_bill_twice_keeps_one_call():
    uow, clock, _ = setup()
    first = request_service_call(uow, clock, QR, ServiceCallType.REQUEST_BILL)
    changes = len(uow.state.table_history)
    second = request_service_call(uow, clock, QR, ServiceCallType.REQUEST_BILL)
    assert second.id == first.id
    assert len(uow.state.service_calls) == 1 and len(uow.state.table_history) == changes


def test_cannot_call_from_free_table():
    uow, clock, _ = setup(open_=False)
    with pytest.raises(TableNotOpen):
        request_service_call(uow, clock, QR, ServiceCallType.CALL_WAITER)


def test_attend_twice_is_invalid_transition():
    uow, clock, _ = setup()
    call = request_service_call(uow, clock, QR, ServiceCallType.CALL_WAITER)
    waiter = uuid4()
    attended = attend_service_call(uow, clock, call.id, waiter)
    assert attended.attended_by == waiter and list_pending_calls(uow) == []
    with pytest.raises(InvalidTransition):
        attend_service_call(uow, clock, call.id, waiter)


def test_session_view_reports_bill_and_calls():
    uow, clock, _ = setup()
    request_service_call(uow, clock, QR, ServiceCallType.CALL_WAITER)
    view = get_diner_session(uow, QR)
    assert view.bill_requested is False and view.pending_calls == ["call_waiter"]
    request_service_call(uow, clock, QR, ServiceCallType.REQUEST_BILL)
    view = get_diner_session(uow, QR)
    assert view.bill_requested is True and sorted(view.pending_calls) == ["call_waiter", "request_bill"]


def test_ordering_blocked_after_bill_requested():
    uow, clock, _ = setup()
    taco = uow.seed_item(make_item())
    request_service_call(uow, clock, QR, ServiceCallType.REQUEST_BILL)
    with pytest.raises(TableNotOpen):
        place_order(uow, clock, PlaceOrderCommand(QR, uuid4(), (LineRequest(taco.id, 1),), None))
