from uuid import UUID

from app.application.ports import Clock, UnitOfWork
from app.application.use_cases.tables import apply_table_event
from app.domain.entities import Order, StatusChange
from app.domain.enums import ChangeSource, OrderStatus, StaffRole, TableEvent, TableStatus
from app.domain.errors import InvalidCustomization, InvalidTransition, NotFound
from app.domain.services.order_state_machine import check_order_transition, is_pending

_TIMESTAMP_FIELD = {
    OrderStatus.PREPARING: "preparing_at",
    OrderStatus.READY: "ready_at",
    OrderStatus.SERVED: "served_at",
    OrderStatus.CANCELLED: "cancelled_at",
}


def _transition(uow: UnitOfWork, clock: Clock, order_id: UUID, target: OrderStatus, staff_id: UUID,
                role: StaffRole) -> Order:
    order = uow.orders.get_for_update(order_id)
    if order is None:
        raise NotFound(details={"order_id": str(order_id)})
    check_order_transition(order.status, target, role)
    now = clock.now()
    uow.history.add_order_change(
        StatusChange(order.id, order.session_id, order.status.value, target.value, ChangeSource.STAFF, staff_id, now))
    order.status = target
    setattr(order, _TIMESTAMP_FIELD[target], now)
    uow.orders.save(order)
    return order


def _finish_round_if_done(uow: UnitOfWork, clock: Clock, order: Order) -> None:
    table = uow.tables.get_for_update(order.table_id)
    if table is None or table.status != TableStatus.AWAITING_ORDER or table.current_session_id != order.session_id:
        return
    if any(is_pending(o.status) for o in uow.orders.list_by_session(order.session_id)):
        return
    apply_table_event(uow, clock, table, TableEvent.ALL_SERVED, ChangeSource.SYSTEM, None)


def advance_order(uow: UnitOfWork, clock: Clock, order_id: UUID, target: OrderStatus, staff_id: UUID,
                  role: StaffRole) -> Order:
    if target not in (OrderStatus.PREPARING, OrderStatus.READY, OrderStatus.SERVED):
        raise InvalidTransition(details={"to": target.value})
    with uow:
        order = _transition(uow, clock, order_id, target, staff_id, role)
        if target == OrderStatus.SERVED:
            _finish_round_if_done(uow, clock, order)
        uow.commit()
        return order


def cancel_order(uow: UnitOfWork, clock: Clock, order_id: UUID, staff_id: UUID, role: StaffRole,
                 reason: str) -> Order:
    if not reason.strip():
        raise InvalidCustomization("Escribe el motivo de la cancelación", {"field": "reason"})
    with uow:
        order = _transition(uow, clock, order_id, OrderStatus.CANCELLED, staff_id, role)
        order.cancelled_by = staff_id
        order.cancel_reason = reason.strip()
        uow.orders.save(order)
        session = uow.sessions.get_for_update(order.session_id)
        session.subtotal_cents -= order.subtotal_cents
        session.cost_cents -= order.cost_cents
        uow.sessions.save(session)
        _finish_round_if_done(uow, clock, order)
        uow.commit()
        return order
