from collections import defaultdict
from uuid import UUID, uuid4

from sqlalchemy import Connection, Table, delete, func, insert, select, update

from app.infrastructure.db import tables as t

_KINDS: dict[str, Table] = {
    "categories": t.categories,
    "ingredients": t.ingredients,
    "extras": t.extras,
    "menu_items": t.menu_items,
    "dining_tables": t.dining_tables,
}
_HIDDEN = {"deleted_at", "created_by", "updated_by"}
_ORDER = {"categories": ("sort_order", "name"), "ingredients": ("name",), "extras": ("name",),
          "menu_items": ("sort_order", "name"), "dining_tables": ("sort_order", "code")}


class SqlCatalogRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def _columns(self, table: Table):
        return [c for c in table.c if c.name not in _HIDDEN]

    def _rows(self, kind: str, where=None) -> list[dict]:
        table = _KINDS[kind]
        stmt = select(*self._columns(table)).where(table.c.deleted_at.is_(None))
        if where is not None:
            stmt = stmt.where(where)
        stmt = stmt.order_by(*(table.c[name] for name in _ORDER[kind]))
        rows = [dict(r._mapping) for r in self._conn.execute(stmt)]
        if kind == "menu_items" and rows:
            self._attach_links(rows)
        return rows

    def _attach_links(self, rows: list[dict]) -> None:
        ids = [r["id"] for r in rows]
        mii, mie, ing, ex = t.menu_item_ingredients, t.menu_item_extras, t.ingredients, t.extras
        ingredients, extras = defaultdict(list), defaultdict(list)
        for r in self._conn.execute(
                select(mii.c.menu_item_id, ing.c.id, ing.c.name, mii.c.is_removable)
                .join(ing, ing.c.id == mii.c.ingredient_id).where(mii.c.menu_item_id.in_(ids))
                .order_by(mii.c.sort_order)):
            ingredients[r.menu_item_id].append({"ingredient_id": r.id, "name": r.name, "is_removable": r.is_removable})
        for r in self._conn.execute(
                select(mie.c.menu_item_id, ex.c.id, ex.c.name, mie.c.max_quantity)
                .join(ex, ex.c.id == mie.c.extra_id).where(mie.c.menu_item_id.in_(ids)).order_by(mie.c.sort_order)):
            extras[r.menu_item_id].append({"extra_id": r.id, "name": r.name, "max_quantity": r.max_quantity})
        for row in rows:
            row["ingredients"], row["extras"] = ingredients[row["id"]], extras[row["id"]]

    def list_all(self, kind: str) -> list[dict]:
        return self._rows(kind)

    def get(self, kind: str, entity_id: UUID) -> dict | None:
        found = self._rows(kind, _KINDS[kind].c.id == entity_id)
        return found[0] if found else None

    def create(self, kind: str, values: dict, staff_id: UUID) -> UUID:
        new_id = uuid4()
        self._conn.execute(insert(_KINDS[kind]).values(id=new_id, created_by=staff_id, updated_by=staff_id, **values))
        return new_id

    def update(self, kind: str, entity_id: UUID, values: dict, staff_id: UUID) -> bool:
        table = _KINDS[kind]
        result = self._conn.execute(update(table).where(table.c.id == entity_id, table.c.deleted_at.is_(None))
                                    .values(updated_by=staff_id, **values))
        return result.rowcount == 1

    def soft_delete(self, kind: str, entity_id: UUID, staff_id: UUID) -> bool:
        return self.update(kind, entity_id, {"deleted_at": func.now()}, staff_id)

    def set_item_links(self, item_id: UUID, ingredients: list[dict] | None, extras: list[dict] | None,
                       staff_id: UUID) -> None:
        if ingredients is not None:
            self._conn.execute(delete(t.menu_item_ingredients).where(t.menu_item_ingredients.c.menu_item_id == item_id))
            if ingredients:
                self._conn.execute(insert(t.menu_item_ingredients), [
                    {"menu_item_id": item_id, "ingredient_id": link["ingredient_id"],
                     "is_removable": link["is_removable"], "sort_order": i, "created_by": staff_id}
                    for i, link in enumerate(ingredients)])
        if extras is not None:
            self._conn.execute(delete(t.menu_item_extras).where(t.menu_item_extras.c.menu_item_id == item_id))
            if extras:
                self._conn.execute(insert(t.menu_item_extras), [
                    {"menu_item_id": item_id, "extra_id": link["extra_id"], "max_quantity": link["max_quantity"],
                     "sort_order": i, "created_by": staff_id} for i, link in enumerate(extras)])
