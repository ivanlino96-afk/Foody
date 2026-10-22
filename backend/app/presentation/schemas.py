from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.enums import OrderStatus
from app.domain.services.pricing import ExtraRequest, LineRequest


class ExtraIn(BaseModel):
    extra_id: UUID
    quantity: int = Field(1, ge=1, le=10)


class LineIn(BaseModel):
    menu_item_id: UUID
    quantity: int = Field(ge=1, le=50)
    removed_ingredient_ids: list[UUID] = Field(default_factory=list, max_length=30)
    extras: list[ExtraIn] = Field(default_factory=list, max_length=20)
    note: str | None = Field(None, max_length=200)

    def to_request(self) -> LineRequest:
        return LineRequest(self.menu_item_id, self.quantity, tuple(self.removed_ingredient_ids),
                           tuple(ExtraRequest(e.extra_id, e.quantity) for e in self.extras), self.note)


class PlaceOrderIn(BaseModel):
    idempotency_key: UUID
    expected_total_cents: int | None = Field(None, ge=0)
    lines: list[LineIn] = Field(min_length=1, max_length=30)


class PlacedOrderOut(BaseModel):
    order_id: UUID
    daily_number: int
    round_number: int
    status: OrderStatus
    subtotal_cents: int


class KitchenStatusIn(BaseModel):
    status: Literal[OrderStatus.PREPARING, OrderStatus.READY]


class OpenTableIn(BaseModel):
    guests_count: int | None = Field(None, ge=1, le=50)


class SessionOut(BaseModel):
    session_id: UUID


class CancelOrderIn(BaseModel):
    reason: str = Field(min_length=1, max_length=200)


class OrderStatusOut(BaseModel):
    order_id: UUID
    status: OrderStatus
