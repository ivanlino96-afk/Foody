from app.domain.enums import OrderStatus, StaffRole
from app.domain.errors import Forbidden, InvalidTransition

_RULES: dict[tuple[OrderStatus, OrderStatus], StaffRole] = {
    (OrderStatus.RECEIVED, OrderStatus.PREPARING): StaffRole.KITCHEN,
    (OrderStatus.PREPARING, OrderStatus.READY): StaffRole.KITCHEN,
    (OrderStatus.READY, OrderStatus.SERVED): StaffRole.WAITER,
    (OrderStatus.RECEIVED, OrderStatus.CANCELLED): StaffRole.WAITER,
    (OrderStatus.PREPARING, OrderStatus.CANCELLED): StaffRole.WAITER,
}

_PENDING = frozenset({OrderStatus.RECEIVED, OrderStatus.PREPARING, OrderStatus.READY})


def check_order_transition(current: OrderStatus, target: OrderStatus, role: StaffRole) -> None:
    required = _RULES.get((current, target))
    if required is None:
        raise InvalidTransition(details={"from": current.value, "to": target.value})
    if role not in (required, StaffRole.ADMIN):
        raise Forbidden(details={"required_role": required.value})


def is_pending(status: OrderStatus) -> bool:
    return status in _PENDING
