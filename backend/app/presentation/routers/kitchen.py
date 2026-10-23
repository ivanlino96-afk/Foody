from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends

from app.application.dto import KitchenOrderView
from app.application.ports import Clock, UnitOfWork
from app.application.use_cases.advance_order import advance_order
from app.application.use_cases.queries import get_active_orders
from app.domain.enums import StaffRole
from app.presentation.deps import CurrentStaff, get_clock, get_uow, require_roles
from app.presentation.schemas import KitchenStatusIn, OrderStatusOut

router = APIRouter(prefix="/kitchen", tags=["kitchen"])
kitchen_only = require_roles(StaffRole.KITCHEN)
# Waiters read the queue to see which orders are ready to take to the table.
kitchen_or_waiter = require_roles(StaffRole.KITCHEN, StaffRole.WAITER)


@router.get("/orders", dependencies=[Depends(kitchen_or_waiter)])
def list_orders(status: Literal["active"] = "active", uow: UnitOfWork = Depends(get_uow)) -> list[KitchenOrderView]:
    return get_active_orders(uow)


@router.post("/orders/{order_id}/status")
def change_status(order_id: UUID, body: KitchenStatusIn, staff: CurrentStaff = Depends(kitchen_only),
                  uow: UnitOfWork = Depends(get_uow), clock: Clock = Depends(get_clock)) -> OrderStatusOut:
    order = advance_order(uow, clock, order_id, body.status, staff.id, staff.role)
    return OrderStatusOut(order_id=order.id, status=order.status)
