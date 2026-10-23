from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, Field

from app.domain.enums import StaffRole

_NAME = {"min_length": 1, "max_length": 80, "pattern": r"^[^\x00]*$"}
Name = Field(**_NAME)
OptionalName = Field(None, **_NAME)
Cents = Field(ge=0, le=10_000_000)


class CategoryIn(BaseModel):
    name: str = Name
    description: str | None = Field(None, max_length=300)
    sort_order: int = 0
    is_active: bool = True


class CategoryPatch(BaseModel):
    name: str | None = OptionalName
    description: str | None = Field(None, max_length=300)
    sort_order: int | None = None
    is_active: bool | None = None


class IngredientIn(BaseModel):
    name: str = Name
    is_available: bool = True


class IngredientPatch(BaseModel):
    name: str | None = OptionalName
    is_available: bool | None = None


class ExtraIn(BaseModel):
    name: str = Name
    price_cents: int = Cents
    cost_cents: int = Field(0, ge=0, le=10_000_000)
    ingredient_id: UUID | None = None
    is_available: bool = True


class ExtraPatch(BaseModel):
    name: str | None = OptionalName
    price_cents: int | None = Field(None, ge=0, le=10_000_000)
    cost_cents: int | None = Field(None, ge=0, le=10_000_000)
    ingredient_id: UUID | None = None
    is_available: bool | None = None


class IngredientLink(BaseModel):
    ingredient_id: UUID
    is_removable: bool = True


class ExtraLink(BaseModel):
    extra_id: UUID
    max_quantity: int = Field(1, ge=1, le=10)


class MenuItemIn(BaseModel):
    category_id: UUID
    name: str = Name
    description: str = Field("", max_length=500)
    price_cents: int = Cents
    cost_cents: int = Field(0, ge=0, le=10_000_000)
    prep_minutes: int | None = Field(None, ge=1, le=240)
    tags: list[str] = Field(default_factory=list, max_length=10)
    sort_order: int = 0
    is_active: bool = True
    is_available: bool = True
    ingredients: list[IngredientLink] = Field(default_factory=list, max_length=40)
    extras: list[ExtraLink] = Field(default_factory=list, max_length=20)


class MenuItemPatch(BaseModel):
    category_id: UUID | None = None
    name: str | None = OptionalName
    description: str | None = Field(None, max_length=500)
    price_cents: int | None = Field(None, ge=0, le=10_000_000)
    cost_cents: int | None = Field(None, ge=0, le=10_000_000)
    prep_minutes: int | None = Field(None, ge=1, le=240)
    tags: list[str] | None = Field(None, max_length=10)
    sort_order: int | None = None
    is_active: bool | None = None
    is_available: bool | None = None
    ingredients: list[IngredientLink] | None = Field(None, max_length=40)
    extras: list[ExtraLink] | None = Field(None, max_length=20)


class TableIn(BaseModel):
    code: str = Field(min_length=1, max_length=20, pattern=r"^[A-Za-z0-9 _-]+$")
    label: str | None = Field(None, max_length=80)
    zone: str | None = Field(None, max_length=40)
    capacity: int | None = Field(None, ge=1, le=50)
    sort_order: int = 0


class TablePatch(BaseModel):
    code: str | None = Field(None, min_length=1, max_length=20, pattern=r"^[A-Za-z0-9 _-]+$")
    label: str | None = Field(None, max_length=80)
    zone: str | None = Field(None, max_length=40)
    capacity: int | None = Field(None, ge=1, le=50)
    sort_order: int | None = None


class StaffIn(BaseModel):
    email: str = Field(max_length=254, pattern=r"^[^@\s\x00]+@[^@\s\x00]+\.[^@\s\x00]+$")
    password: str = Field(min_length=8, max_length=72)
    full_name: str = Name
    role: StaffRole


class StaffPatch(BaseModel):
    full_name: str | None = OptionalName
    role: StaffRole | None = None
    is_active: bool | None = None


class SettingsIn(BaseModel):
    name: str = Name
    auto_release_minutes: int = Field(ge=0, le=240)
    tip_options: list[Annotated[int, Field(ge=1, le=100)]] = Field(min_length=1, max_length=5)
