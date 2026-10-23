import pytest
from sqlalchemy import text

from tests.integration.conftest import RESET_ACTIVITY_SQL, WAITER_ID, staff_headers

pytestmark = pytest.mark.integration

A = "/api/v1/admin"


@pytest.fixture
def floor(api, admin_headers, engine):
    """Current plan as a PUT body (seed areas kept as they are); test areas and tables are removed afterwards."""
    current = api.get(f"{A}/floor", headers=admin_headers).json()
    areas = [{k: a[k] for k in ("id", "name", "kind", "x", "y", "width", "depth")} | {"key": a["id"]}
             for a in current["areas"]]
    yield {"areas": areas, "tables": [], "deleted_table_ids": []}
    with engine.begin() as c:
        c.execute(text(RESET_ACTIVITY_SQL))
        c.execute(text("delete from dining_tables where code like 'ZZ%'; delete from floor_areas where name like 'zz %'"))


def put(api, h, body):
    return api.put(f"{A}/floor", json=body, headers=h)


def zz_tables(body):
    return {t["code"]: t for t in body["tables"] if t["code"].startswith("ZZ")}


def test_saving_the_plan_creates_areas_and_places_tables(api, admin_headers, floor):
    floor["areas"].append({"key": "new", "name": "zz Roof", "kind": "roof", "x": 20, "y": 0, "width": 8, "depth": 6})
    floor["tables"] = [{"code": "ZZ1", "capacity": 4, "kind": "round", "pos_x": 22, "pos_y": 3, "rotation": 90},
                       {"code": "ZZ2", "capacity": 8, "kind": "bar", "pos_x": 60, "pos_y": 60}]
    r = put(api, admin_headers, floor)
    assert r.status_code == 200, r.text
    roof = next(a for a in r.json()["areas"] if a["name"] == "zz Roof")
    tables = zz_tables(r.json())
    assert tables["ZZ1"]["area_id"] == roof["id"] and tables["ZZ1"]["zone"] == "zz Roof"
    assert tables["ZZ1"]["kind"] == "round" and tables["ZZ1"]["rotation"] == 90 and len(tables["ZZ1"]["qr_token"]) == 32
    assert tables["ZZ2"]["area_id"] is None and tables["ZZ2"]["zone"] is None

    waiter = api.get("/api/v1/waiter/tables", headers=staff_headers(WAITER_ID)).json()
    zz1 = next(t for t in waiter if t["code"] == "ZZ1")
    assert (zz1["pos_x"], zz1["pos_y"], zz1["capacity"], zz1["kind"]) == (22, 3, 4, "round")
    areas = api.get("/api/v1/waiter/floor-areas", headers=staff_headers(WAITER_ID)).json()
    assert "zz Roof" in [a["name"] for a in areas]


def test_codes_can_be_swapped_and_duplicates_are_rejected(api, admin_headers, floor):
    floor["tables"] = [{"code": "ZZ1", "capacity": 2}, {"code": "ZZ2", "capacity": 4}]
    tables = zz_tables(put(api, admin_headers, floor).json())
    floor["tables"] = [{"id": tables["ZZ1"]["id"], "code": "ZZ2", "capacity": 2},
                       {"id": tables["ZZ2"]["id"], "code": "ZZ1", "capacity": 4}]
    swapped = zz_tables(put(api, admin_headers, floor).json())
    assert swapped["ZZ2"]["id"] == tables["ZZ1"]["id"] and swapped["ZZ1"]["id"] == tables["ZZ2"]["id"]

    floor["tables"] = [{"code": "ZZ7", "capacity": 2}, {"code": "ZZ7", "capacity": 4}]
    r = put(api, admin_headers, floor)
    assert r.status_code == 409 and "ZZ7" in r.json()["message"]


def test_removed_area_is_deleted_and_busy_tables_cannot_be_deleted(api, admin_headers, floor):
    seed = list(floor["areas"])
    floor["areas"].append({"key": "g", "name": "zz Jardín", "kind": "jardin", "x": 30, "y": 0, "width": 5, "depth": 5})
    floor["tables"] = [{"code": "ZZ5", "capacity": 4, "pos_x": 32, "pos_y": 2}]
    table = zz_tables(put(api, admin_headers, floor).json())["ZZ5"]
    assert table["area_id"] is not None

    r = put(api, admin_headers, {"areas": seed, "tables": [], "deleted_table_ids": []})
    assert "zz Jardín" not in [a["name"] for a in r.json()["areas"]]
    assert zz_tables(r.json())["ZZ5"]["area_id"] is None

    api.post(f"/api/v1/waiter/tables/{table['id']}/open", json={}, headers=admin_headers)
    r = put(api, admin_headers, {"areas": seed, "tables": [], "deleted_table_ids": [table["id"]]})
    assert r.status_code == 409 and r.json()["code"] == "invalid_transition"
