from app.domain.enums import TableEvent, TableStatus
from app.domain.errors import InvalidTransition

_ORDERING = frozenset({TableStatus.OCCUPIED, TableStatus.AWAITING_ORDER, TableStatus.SERVED})

_TRANSITIONS: dict[TableEvent, tuple[frozenset[TableStatus], TableStatus]] = {
    TableEvent.OPEN: (frozenset({TableStatus.FREE}), TableStatus.OCCUPIED),
    TableEvent.ORDER_PLACED: (_ORDERING, TableStatus.AWAITING_ORDER),
    TableEvent.ALL_SERVED: (frozenset({TableStatus.AWAITING_ORDER}), TableStatus.SERVED),
    TableEvent.BILL_REQUESTED: (_ORDERING, TableStatus.BILL_REQUESTED),
    TableEvent.PAID: (frozenset({TableStatus.BILL_REQUESTED}), TableStatus.CLOSED),
    TableEvent.RELEASE: (frozenset({TableStatus.CLOSED}), TableStatus.FREE),
    TableEvent.REOPEN: (frozenset({TableStatus.CLOSED}), TableStatus.OCCUPIED),
}


def next_table_status(current: TableStatus, event: TableEvent) -> TableStatus:
    allowed_from, target = _TRANSITIONS[event]
    if current not in allowed_from:
        raise InvalidTransition(details={"from": current.value, "event": event.value})
    return target


def can_order(status: TableStatus) -> bool:
    return status in _ORDERING
