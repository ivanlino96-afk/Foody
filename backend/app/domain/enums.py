from enum import StrEnum


class TableStatus(StrEnum):
    FREE = "free"
    OCCUPIED = "occupied"
    AWAITING_ORDER = "awaiting_order"
    SERVED = "served"
    BILL_REQUESTED = "bill_requested"
    CLOSED = "closed"


class OrderStatus(StrEnum):
    RECEIVED = "received"
    PREPARING = "preparing"
    READY = "ready"
    SERVED = "served"
    CANCELLED = "cancelled"


class ChangeSource(StrEnum):
    STAFF = "staff"
    DINER = "diner"
    SYSTEM = "system"
    PAYMENT = "payment"


class StaffRole(StrEnum):
    ADMIN = "admin"
    KITCHEN = "kitchen"
    WAITER = "waiter"


class TableEvent(StrEnum):
    OPEN = "open"
    ORDER_PLACED = "order_placed"
    ALL_SERVED = "all_served"
    BILL_REQUESTED = "bill_requested"
    PAID = "paid"
    RELEASE = "release"
    REOPEN = "reopen"
