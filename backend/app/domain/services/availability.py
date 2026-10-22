from dataclasses import dataclass
from uuid import UUID

from app.domain.entities import Extra, MenuItem


@dataclass(frozen=True)
class ItemAvailability:
    available: bool
    reason: str | None
    unavailable_ingredient_ids: frozenset[UUID]
    unavailable_extra_ids: frozenset[UUID]


def extra_available(extra: Extra) -> bool:
    return extra.is_available and (extra.ingredient is None or extra.ingredient.is_available)


def item_availability(item: MenuItem) -> ItemAvailability:
    unavailable_ingredients = frozenset(
        i.ingredient.id for i in item.ingredients if i.is_removable and not i.ingredient.is_available
    )
    unavailable_extras = frozenset(e.extra.id for e in item.extras if not extra_available(e.extra))

    reason: str | None = None
    if item.is_deleted or not item.is_active:
        reason = "item_inactive"
    elif not item.is_available:
        reason = "item_disabled"
    else:
        missing = next((i.ingredient for i in item.ingredients
                        if not i.is_removable and not i.ingredient.is_available), None)
        if missing is not None:
            reason = f"ingredient_unavailable:{missing.name}"

    return ItemAvailability(reason is None, reason, unavailable_ingredients, unavailable_extras)
