from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.application.dto import TableMapView
from app.application.ports import Clock, UnitOfWork
from app.application.use_cases.advance_order import advance_order, cancel_order
from app.application.use_cases.queries import get_tables_map
from app.application.use_cases.tables import open_table, release_table, reopen_table
from app.domain.enums import OrderStatus, StaffRole
from app.presentation.deps import CurrentStaff, get_clock, get_uow, require_roles
from app.presentation.schemas import CancelOrderIn, OpenTableIn, OrderStatusOut, SessionOut

router = APIRouter(prefix="/waiter", tags=["waiter"])
waiter_only = require_roles(StaffRole.WAITER)


@router.get("/tables", dependencies=[Depends(waiter_only)])
def list_tables(uow: UnitOfWork = Depends(get_uow)) -> list[TableMapView]:
    return get_tables_map(uow)


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
