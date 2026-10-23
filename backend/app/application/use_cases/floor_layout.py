from uuid import UUID

from app.application.ports import UnitOfWork
from app.application.use_cases.admin_tables import new_qr_token
from app.domain.enums import TableStatus
from app.domain.errors import DuplicateTableCode, InvalidTransition, NotFound
from app.domain.services.floor import AreaRect, area_at

_AREA_FIELDS = ("name", "kind", "x", "y", "width", "depth")
_TABLE_FIELDS = ("code", "label", "capacity", "kind", "pos_x", "pos_y", "rotation")


def get_floor(uow: UnitOfWork) -> dict:
    with uow:
        return {"areas": uow.catalog.list_all("floor_areas"), "tables": uow.catalog.list_all("dining_tables")}


def list_floor_areas(uow: UnitOfWork) -> list[dict]:
    with uow:
        return uow.catalog.list_all("floor_areas")


def save_floor(uow: UnitOfWork, areas: list[dict], tables: list[dict], deleted_table_ids: list[UUID],
               staff_id: UUID) -> dict:
    """Saves the whole plan in one transaction: areas are replaced, tables are moved, created or deleted, and each
    placed table takes the area (and zone name) under its center."""
    codes = [t["code"].strip() for t in tables]
    duplicated = sorted({c for c in codes if codes.count(c) > 1})
    if duplicated:
        raise DuplicateTableCode(f"El número {duplicated[0]} está repetido", {"codes": duplicated})

    with uow:
        current_areas = {a["id"] for a in uow.catalog.list_all("floor_areas")}
        area_ids: dict[str, UUID] = {}
        names: dict[UUID, str] = {}
        rects: list[AreaRect] = []
        for i, area in enumerate(areas):
            values = {k: area[k] for k in _AREA_FIELDS} | {"sort_order": i}
            area_id = area.get("id")
            if area_id is not None:
                if area_id not in current_areas or not uow.catalog.update("floor_areas", area_id, values, staff_id):
                    raise NotFound(details={"area_id": str(area_id)})
            else:
                area_id = uow.catalog.create("floor_areas", values, staff_id)
            area_ids[area["key"]] = area_id
            names[area_id] = area["name"]
            rects.append(AreaRect(str(area_id), area["x"], area["y"], area["width"], area["depth"]))
        for gone in current_areas - set(area_ids.values()):
            uow.catalog.soft_delete("floor_areas", gone, staff_id)

        for table_id in deleted_table_ids:
            table = uow.tables.get_for_update(table_id)
            if table is None:
                raise NotFound(details={"table_id": str(table_id)})
            if table.status != TableStatus.FREE:
                raise InvalidTransition(f"La mesa {table.code} no está libre; no se puede borrar",
                                        {"status": table.status.value})
            uow.catalog.soft_delete("dining_tables", table_id, staff_id)

        current_tables = {t["id"]: t for t in uow.catalog.list_all("dining_tables")}
        sent = {t["id"] for t in tables if t.get("id") is not None}
        next_order = max((t["sort_order"] for t in current_tables.values()), default=0) + 1
        # Codes may be swapped between tables (M1 <-> M2): park the changing ones first so the unique index holds.
        for table in tables:
            existing = current_tables.get(table.get("id"))
            if existing is not None and existing["code"] != table["code"].strip():
                uow.catalog.update("dining_tables", existing["id"], {"code": f"~{existing['id'].hex[:18]}"}, staff_id)

        for table in tables:
            values = {k: table[k] for k in _TABLE_FIELDS if k in table}
            values["code"] = table["code"].strip()
            area_key = area_at(table.get("pos_x"), table.get("pos_y"), rects)
            area_id = UUID(area_key) if area_key else None
            values["area_id"] = area_id
            if table.get("pos_x") is not None:
                values["zone"] = names.get(area_id) if area_id else None
            table_id = table.get("id")
            if table_id is not None:
                if table_id not in current_tables or not uow.catalog.update("dining_tables", table_id, values,
                                                                             staff_id):
                    raise NotFound(details={"table_id": str(table_id)})
            else:
                uow.catalog.create("dining_tables", values | {"qr_token": new_qr_token(), "sort_order": next_order},
                                   staff_id)
                next_order += 1

        # Tables left out of the payload lose an area that no longer exists.
        for table_id, row in current_tables.items():
            if table_id not in sent and row["area_id"] is not None and row["area_id"] not in area_ids.values():
                uow.catalog.update("dining_tables", table_id, {"area_id": None}, staff_id)

        result = {"areas": uow.catalog.list_all("floor_areas"), "tables": uow.catalog.list_all("dining_tables")}
        uow.commit()
        return result
