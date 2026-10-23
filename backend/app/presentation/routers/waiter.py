from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.application.dto import ServiceCallView, TableMapView
from app.application.ports import Clock, UnitOfWork
from app.application.use_cases.advance_order import advance_order, cancel_order
from app.application.use_cases.floor_layout import list_floor_areas
from app.application.use_cases.payments import register_manual_payment
from app.application.use_cases.queries import get_tables_map
from app.application.use_cases.service_calls import attend_service_call, list_pending_calls, request_bill_by_staff
from app.application.use_cases.tables import open_table, release_table, reopen_table
from app.domain.enums import OrderStatus, StaffRole
from app.domain.services.billing import balance_cents
from app.presentation.deps import CurrentStaff, get_clock, get_uow, require_roles
from app.presentation.schemas import CancelOrderIn, OpenTableIn, OrderStatusOut, PaymentIn, PaymentOut, SessionOut

router = APIRouter(prefix="/waiter", tags=["waiter"])
waiter_only = require_roles(StaffRole.WAITER)


@router.get("/tables", dependencies=[Depends(waiter_only)])
def list_tables(uow: UnitOfWork = Depends(get_uow)) -> list[TableMapView]:
    return get_tables_map(uow)


@router.get("/floor-areas", dependencies=[Depends(waiter_only)])
def floor_areas(uow: UnitOfWork = Depends(get_uow)) -> list[dict]:
    return list_floor_areas(uow)


@router.post("/tables/{table_id}/open")
def open_(table_id: UUID, body: OpenTableIn, staff: CurrentStaff = Depends(waiter_only),
          uow: UnitOfWork = Depends(get_uow), clock: Clock = Depends(get_clock)) -> SessionOut:
    return SessionOut(session_id=open_table(uow, clock, table_id, staff.id, body.guests_count).id)


@router.post("/tables/{table_id}/reopen")
def reopen(table_id: UUID, body: OpenTableIn | None = None, staff: CurrentStaff = Depends(waiter_only),
           uow: UnitOfWork = Depends(get_uow), clock: Clock = Depends(get_clock)) -> SessionOut:
    guests = body.guests_count if body else None
    return SessionOut(session_id=reopen_table(uow, clock, table_id, staff.id, guests).id)


@router.post("/tables/{table_id}/release", status_code=status.HTTP_204_NO_CONTENT)
def release(table_id: UUID, staff: CurrentStaff = Depends(waiter_only), uow: UnitOfWork = Depends(get_uow),
            clock: Clock = Depends(get_clock)) -> Response:
    release_table(uow, clock, table_id, staff.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/orders/{order_id}/served")
def served(order_id: UUID, staff: CurrentStaff = Depends(waiter_only), uow: UnitOfWork = Depends(get_uow),
           clock: Clock = Depends(get_clock)) -> OrderStatusOut:
    order = advance_order(uow, clock, order_id, OrderStatus.SERVED, staff.id, staff.role)
    return OrderStatusOut(order_id=order.id, status=order.status)


@router.post("/orders/{order_id}/cancel")
def cancel(order_id: UUID, body: CancelOrderIn, staff: CurrentStaff = Depends(waiter_only),
           uow: UnitOfWork = Depends(get_uow), clock: Clock = Depends(get_clock)) -> OrderStatusOut:
    order = cancel_order(uow, clock, order_id, staff.id, staff.role, body.reason)
    return OrderStatusOut(order_id=order.id, status=order.status)


@router.post("/tables/{table_id}/request-bill", status_code=status.HTTP_204_NO_CONTENT)
def request_bill(table_id: UUID, staff: CurrentStaff = Depends(waiter_only), uow: UnitOfWork = Depends(get_uow),
                 clock: Clock = Depends(get_clock)) -> Response:
    request_bill_by_staff(uow, clock, table_id, staff.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/service-calls", dependencies=[Depends(waiter_only)])
def service_calls(uow: UnitOfWork = Depends(get_uow)) -> list[ServiceCallView]:
    return list_pending_calls(uow)


@router.post("/service-calls/{call_id}/attend", status_code=status.HTTP_204_NO_CONTENT)
def attend(call_id: UUID, staff: CurrentStaff = Depends(waiter_only), uow: UnitOfWork = Depends(get_uow),
           clock: Clock = Depends(get_clock)) -> Response:
    attend_service_call(uow, clock, call_id, staff.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/sessions/{session_id}/payments", status_code=status.HTTP_201_CREATED)
def pay(session_id: UUID, body: PaymentIn, staff: CurrentStaff = Depends(waiter_only),
        uow: UnitOfWork = Depends(get_uow), clock: Clock = Depends(get_clock)) -> PaymentOut:
    payment = register_manual_payment(uow, clock, session_id, body.method, body.amount_cents, body.tip_cents,
                                      staff.id)
    with uow:
        session = uow.sessions.get(session_id)
        table = uow.tables.get(session.table_id)
    return PaymentOut(payment_id=payment.id, balance_cents=balance_cents(session), table_status=table.status)
