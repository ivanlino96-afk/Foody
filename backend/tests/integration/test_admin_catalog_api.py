import pytest

from tests.integration.conftest import WAITER_ID, staff_headers

pytestmark = pytest.mark.integration

A = "/api/v1/admin"
M1_MENU = "/api/v1/diner/tables/dev-qr-m1-000000000000000000000000/menu"


def make_dish(api, h):
    cat = api.post(f"{A}/categories", json={"name": "zz Postres", "sort_order": 9}, headers=h)
    assert cat.status_code == 201, cat.text
    ing = api.post(f"{A}/ingredients", json={"name": "zz Fresa"}, headers=h).json()
    ing2 = api.post(f"{A}/ingredients", json={"name": "zz Crema"}, headers=h).json()
    extra = api.post(f"{A}/extras", json={"name": "zz Miel", "price_cents": 1000, "cost_cents": 200}, headers=h).json()
    body = {"category_id": cat.json()["id"], "name": "zz Fresas con crema", "price_cents": 9000, "cost_cents": 2500,
            "tags": ["vegetariano"], "ingredients": [{"ingredient_id": ing["id"], "is_removable": False},
                                                    {"ingredient_id": ing2["id"], "is_removable": True}],
            "extras": [{"extra_id": extra["id"], "max_quantity": 2}]}
    r = api.post(f"{A}/menu-items", json=body, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


def diner_item(api, name):
    return next((i for c in api.get(M1_MENU).json() for i in c["items"] if i["name"] == name), None)


def test_admin_creates_dish_with_ingredients_and_extras(api, admin_headers):
    dish = make_dish(api, admin_headers)
    assert [i["name"] for i in dish["ingredients"]] == ["zz Fresa", "zz Crema"]
    seen = diner_item(api, "zz Fresas con crema")
    assert [(i["name"], i["is_removable"]) for i in seen["ingredients"]] == [("zz Fresa", False), ("zz Crema", True)]
    assert [(e["name"], e["max_quantity"]) for e in seen["extras"]] == [("zz Miel", 2)]


def test_update_dish_replaces_links(api, admin_headers):
    dish = make_dish(api, admin_headers)
    r = api.patch(f"{A}/menu-items/{dish['id']}", json={"price_cents": 9500, "extras": []}, headers=admin_headers)
    assert r.status_code == 200 and r.json()["price_cents"] == 9500 and r.json()["extras"] == []
    assert len(r.json()["ingredients"]) == 2


def test_admin_menu_shows_costs_diner_does_not(api, admin_headers):
    make_dish(api, admin_headers)
    items = api.get(f"{A}/menu-items", headers=admin_headers).json()
    assert next(i for i in items if i["name"] == "zz Fresas con crema")["cost_cents"] == 2500
    assert "cost_cents" not in diner_item(api, "zz Fresas con crema")


def test_soft_deleted_item_disappears_from_menu(api, admin_headers):
    dish = make_dish(api, admin_headers)
    assert api.delete(f"{A}/menu-items/{dish['id']}", headers=admin_headers).status_code == 204
    assert diner_item(api, "zz Fresas con crema") is None
    assert all(i["id"] != dish["id"] for i in api.get(f"{A}/menu-items", headers=admin_headers).json())


def test_duplicate_ingredient_name_is_409(api, admin_headers):
    api.post(f"{A}/ingredients", json={"name": "zz Sal"}, headers=admin_headers)
    r = api.post(f"{A}/ingredients", json={"name": "zz Sal"}, headers=admin_headers)
    assert r.status_code == 409 and r.json()["code"] == "conflict"


def test_duplicate_table_code_is_409(api, admin_headers):
    assert api.post(f"{A}/tables", json={"code": "ZZ1"}, headers=admin_headers).status_code == 201
    r = api.post(f"{A}/tables", json={"code": "ZZ1"}, headers=admin_headers)
    assert r.status_code == 409 and r.json()["code"] == "conflict"


def test_regenerate_qr_invalidates_old_token(api, admin_headers):
    table = api.post(f"{A}/tables", json={"code": "ZZ2", "zone": "Terraza"}, headers=admin_headers).json()
    old = table["qr_token"]
    assert len(old) == 32
    opened = api.post(f"/api/v1/waiter/tables/{table['id']}/open", json={}, headers=admin_headers)
    assert opened.status_code == 200
    new = api.post(f"{A}/tables/{table['id']}/regenerate-qr", headers=admin_headers).json()["qr_token"]
    assert new != old and len(new) == 32
    assert api.get(f"/api/v1/diner/tables/{old}").status_code == 404
    assert api.get(f"/api/v1/diner/tables/{new}").json()["status"] == "occupied"


def test_cannot_delete_busy_table(api, admin_headers):
    table = api.post(f"{A}/tables", json={"code": "ZZ3"}, headers=admin_headers).json()
    api.post(f"/api/v1/waiter/tables/{table['id']}/open", json={}, headers=admin_headers)
    r = api.delete(f"{A}/tables/{table['id']}", headers=admin_headers)
    assert r.status_code == 409 and r.json()["code"] == "invalid_transition"


def test_qr_png_encodes_public_url(api, admin_headers):
    table = api.post(f"{A}/tables", json={"code": "ZZ4"}, headers=admin_headers).json()
    r = api.get(f"{A}/tables/{table['id']}/qr.png", headers=admin_headers)
    assert r.status_code == 200 and r.headers["content-type"] == "image/png"
    assert r.content.startswith(b"\x89PNG")


def test_non_admin_gets_403(api):
    r = api.get(f"{A}/menu-items", headers=staff_headers(WAITER_ID))
    assert r.status_code == 403
