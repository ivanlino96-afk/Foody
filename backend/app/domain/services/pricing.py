from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any
from uuid import UUID

from app.domain.entities import MenuItem
from app.domain.errors import InvalidCustomization, ItemUnavailable
from app.domain.services.availability import extra_available, item_availability

MAX_LINE_QUANTITY = 50


@dataclass(frozen=True)
class ExtraRequest:
    extra_id: UUID
    quantity: int = 1


@dataclass(frozen=True)
class LineRequest:
    menu_item_id: UUID
    quantity: int
    removed_ingredient_ids: tuple[UUID, ...] = ()
    extras: tuple[ExtraRequest, ...] = ()
    note: str | None = None


@dataclass(frozen=True)
class PricedExtra:
    extra_id: UUID
    name: str
    unit_price_cents: int
    unit_cost_cents: int
    quantity: int


@dataclass(frozen=True)
class RemovedIngredient:
    ingredient_id: UUID
    name: str


@dataclass(frozen=True)
class PricedLine:
    menu_item_id: UUID
    item_name: str
    unit_price_cents: int
    unit_cost_cents: int
    quantity: int
    note: str | None
    extras: tuple[PricedExtra, ...]
    removed: tuple[RemovedIngredient, ...]
    line_total_cents: int
    line_cost_cents: int


@dataclass(frozen=True)
class PricedOrder:
    lines: tuple[PricedLine, ...]
    subtotal_cents: int
    cost_cents: int


def _invalid(index: int, field: str, message: str) -> InvalidCustomization:
    return InvalidCustomization(message, {"index": index, "field": field})


def _validate(index: int, item: MenuItem | None, req: LineRequest) -> None:
    if not 1 <= req.quantity <= MAX_LINE_QUANTITY:
        raise _invalid(index, "quantity", f"La cantidad debe estar entre 1 y {MAX_LINE_QUANTITY}")
    if item is None:
        return
    removable = {i.ingredient.id for i in item.ingredients if i.is_removable}
    for ingredient_id in req.removed_ingredient_ids:
        if ingredient_id not in removable:
            raise _invalid(index, "removed_ingredient_ids", "Ese ingrediente no se puede quitar")
    allowed = {e.extra.id: e.max_quantity for e in item.extras}
    seen: set[UUID] = set()
    for extra in req.extras:
        if extra.extra_id not in allowed:
            raise _invalid(index, "extras", "Ese extra no pertenece al platillo")
        if extra.extra_id in seen:
            raise _invalid(index, "extras", "Extra repetido")
        if not 1 <= extra.quantity <= allowed[extra.extra_id]:
            raise _invalid(index, "extras", "Cantidad de extra no válida")
        seen.add(extra.extra_id)


def _unavailable_reason(item: MenuItem | None, req: LineRequest) -> str | None:
    if item is None:
        return "not_found"
    availability = item_availability(item)
    if not availability.available:
        return availability.reason
    extras = {e.extra.id: e.extra for e in item.extras}
    for chosen in req.extras:
        if not extra_available(extras[chosen.extra_id]):
            return f"extra_unavailable:{extras[chosen.extra_id].name}"
    return None


def _price_line(item: MenuItem, req: LineRequest) -> PricedLine:
    extras_by_id = {e.extra.id: e.extra for e in item.extras}
    priced_extras = tuple(
        PricedExtra(e.extra_id, extras_by_id[e.extra_id].name, extras_by_id[e.extra_id].price_cents,
                    extras_by_id[e.extra_id].cost_cents, e.quantity)
        for e in req.extras
    )
    requested = set(req.removed_ingredient_ids)
    removed = tuple(
        RemovedIngredient(i.ingredient.id, i.ingredient.name)
        for i in item.ingredients
        if i.is_removable and (i.ingredient.id in requested or not i.ingredient.is_available)
    )
    unit_total = item.price_cents + sum(e.unit_price_cents * e.quantity for e in priced_extras)
    unit_cost = item.cost_cents + sum(e.unit_cost_cents * e.quantity for e in priced_extras)
    return PricedLine(item.id, item.name, item.price_cents, item.cost_cents, req.quantity, req.note,
                      priced_extras, removed, unit_total * req.quantity, unit_cost * req.quantity)


def price_order(menu: Mapping[UUID, MenuItem], requests: Sequence[LineRequest]) -> PricedOrder:
    if not requests:
        raise InvalidCustomization("La orden no tiene platillos", {"field": "lines"})
    for index, req in enumerate(requests):
        _validate(index, menu.get(req.menu_item_id), req)

    unavailable: list[dict[str, Any]] = []
    for index, req in enumerate(requests):
        reason = _unavailable_reason(menu.get(req.menu_item_id), req)
        if reason is not None:
            unavailable.append({"index": index, "menu_item_id": str(req.menu_item_id), "reason": reason})
    if unavailable:
        raise ItemUnavailable(unavailable)

    lines = tuple(_price_line(menu[req.menu_item_id], req) for req in requests)
    return PricedOrder(lines, sum(line.line_total_cents for line in lines), sum(line.line_cost_cents for line in lines))
