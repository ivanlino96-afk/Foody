from dataclasses import dataclass, field
from datetime import datetime
from uuid import UUID

from app.domain.entities import MenuItem
from app.domain.enums import OrderStatus, ServiceCallType, StaffRole, TableStatus


@dataclass(frozen=True)
class MenuCategoryView:
    id: UUID
    name: str
    items: list[MenuItem] = field(default_factory=list)


@dataclass(frozen=True)
class StaffMember:
    id: UUID
    full_name: str
    role: StaffRole
    is_active: bool


@dataclass(frozen=True)
class DinerTableView:
    code: str
    label: str | None
    status: TableStatus
    can_order: bool


@dataclass(frozen=True)
class DinerIngredientView:
    id: UUID
    name: str
    is_removable: bool
    available: bool


@dataclass(frozen=True)
class DinerExtraView:
    id: UUID
    name: str
    price_cents: int
    max_quantity: int
    available: bool


@dataclass(frozen=True)
class DinerMenuItemView:
    id: UUID
    name: str
    description: str
    price_cents: int
    photo_path: str | None
    prep_minutes: int | None
    tags: tuple[str, ...]
    available: bool
    unavailable_reason: str | None
    ingredients: list[DinerIngredientView]
    extras: list[DinerExtraView]


@dataclass(frozen=True)
class DinerMenuCategoryView:
    id: UUID
    name: str
    items: list[DinerMenuItemView]


@dataclass(frozen=True)
class OrderLineView:
    item_name: str
    quantity: int
    note: str | None
    extras: list[str]
    removed: list[str]
    line_total_cents: int


@dataclass(frozen=True)
class DinerRoundView:
    order_id: UUID
    daily_number: int
    round_number: int
    status: OrderStatus
    lines: list[OrderLineView]
    subtotal_cents: int
    created_at: datetime


@dataclass(frozen=True)
class DinerSessionView:
    rounds: list[DinerRoundView]
    subtotal_cents: int
    tip_cents: int
    paid_cents: int
    balance_cents: int
    bill_requested: bool = False
    pending_calls: list[str] = field(default_factory=list)


@dataclass(frozen=True)
class KitchenOrderView:
    id: UUID
    daily_number: int
    table_code: str
    round_number: int
    status: OrderStatus
    created_at: datetime
    lines: list[OrderLineView]


@dataclass(frozen=True)
class TableMapView:
    id: UUID
    code: str
    label: str | None
    zone: str | None
    status: TableStatus
    status_changed_at: datetime
    pending_orders: int
    ready_orders: int
    session_id: UUID | None = None
    balance_cents: int = 0
    pending_calls: int = 0
    capacity: int | None = None
    kind: str = "table"
    area_id: UUID | None = None
    pos_x: float | None = None
    pos_y: float | None = None
    rotation: int = 0
    guests_count: int | None = None
    opened_at: datetime | None = None
    consumed_cents: int = 0
    served_orders: int = 0


@dataclass(frozen=True)
class ServiceCallView:
    id: UUID
    table_code: str
    type: ServiceCallType
    created_at: datetime


@dataclass(frozen=True)
class AvailabilityRow:
    id: UUID
    name: str
    is_available: bool
    used_in: int = 0


@dataclass(frozen=True)
class AvailabilityBoardView:
    items: list[AvailabilityRow]
    ingredients: list[AvailabilityRow]
    extras: list[AvailabilityRow]


@dataclass(frozen=True)
class HourSales:
    hour: int
    sales_cents: int


@dataclass(frozen=True)
class DashboardView:
    sales_cents: int
    tips_cents: int
    profit_cents: int
    margin_pct: float
    orders_count: int
    cancelled_count: int
    cancel_reasons: list[str]
    avg_ticket_cents: int
    avg_prep_seconds: int | None
    avg_delivery_seconds: int | None
    occupied_tables: int
    total_tables: int
    sales_by_hour: list[HourSales]
