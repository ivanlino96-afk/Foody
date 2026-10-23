from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from typing import TYPE_CHECKING
from uuid import UUID

from app.domain.enums import ChangeSource, OrderStatus, TableStatus

if TYPE_CHECKING:
    from app.domain.services.pricing import PricedLine


@dataclass(frozen=True)
class Ingredient:
    id: UUID
    name: str
    is_available: bool


@dataclass(frozen=True)
class ItemIngredient:
    ingredient: Ingredient
    is_removable: bool


@dataclass(frozen=True)
class Extra:
    id: UUID
    name: str
    price_cents: int
    cost_cents: int
    is_available: bool
    ingredient: Ingredient | None


@dataclass(frozen=True)
class ItemExtra:
    extra: Extra
    max_quantity: int = 1


@dataclass(frozen=True)
class MenuItem:
    id: UUID
    category_id: UUID
    name: str
    price_cents: int
    cost_cents: int
    is_available: bool
    is_active: bool
    is_deleted: bool
    ingredients: tuple[ItemIngredient, ...]
    extras: tuple[ItemExtra, ...]
    description: str = ""
    photo_path: str | None = None
    prep_minutes: int | None = None
    tags: tuple[str, ...] = ()


@dataclass
class DiningTable:
    id: UUID
    code: str
    label: str | None
    zone: str | None
    capacity: int | None
    qr_token: str
    status: TableStatus
    current_session_id: UUID | None
    status_changed_at: datetime


@dataclass
class TableSession:
    id: UUID
    table_id: UUID
    opened_by: UUID | None
    opened_at: datetime
    guests_count: int | None
    subtotal_cents: int = 0
    cost_cents: int = 0
    tip_cents: int = 0
    paid_cents: int = 0
    closed_at: datetime | None = None


@dataclass
class Order:
    id: UUID
    session_id: UUID
    table_id: UUID
    daily_number: int
    round_number: int
    status: OrderStatus
    idempotency_key: UUID
    subtotal_cents: int
    cost_cents: int
    lines: list[PricedLine]
    created_at: datetime
    preparing_at: datetime | None = None
    ready_at: datetime | None = None
    served_at: datetime | None = None
    cancelled_at: datetime | None = None
    cancelled_by: UUID | None = None
    cancel_reason: str | None = None


@dataclass(frozen=True)
class StatusChange:
    entity_id: UUID
    session_id: UUID | None
    from_status: str | None
    to_status: str
    source: ChangeSource
    changed_by: UUID | None
    changed_at: datetime = field()
