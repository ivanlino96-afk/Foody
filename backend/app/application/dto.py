from dataclasses import dataclass, field
from uuid import UUID

from app.domain.entities import MenuItem
from app.domain.enums import StaffRole


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
