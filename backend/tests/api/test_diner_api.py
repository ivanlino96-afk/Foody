from uuid import uuid4

import pytest
from sqlalchemy.exc import IntegrityError

from app.application.use_cases.tables import open_table
from app.domain.entities import ItemExtra, ItemIngredient
from app.domain.enums import TableStatus
from tests.fakes import make_extra, make_ingredient, make_item

QR = "qr-m5"
BASE = f"/api/v1/diner/tables/{QR}"


@pytest.fixture
def table(uow):
    return uow.seed_table(code="M5", qr_token=QR)


@pytest.fixture
def taco(uow):
    cebolla = make_ingredient("Cebolla")
    return uow.seed_item(make_item("Taco", price_cents=4000, cost_cents=1500,
                                   ingredients=[ItemIngredient(cebolla, True)],
                                   extras=[ItemExtra(make_extra("Queso", 2000, 500), 2)]))


@pytest.fixture
def opened(uow, clock, table):
    return open_table(uow, clock, table.id, uuid4())


def order_body(item, qty=1, key=None, **extra):
    return {"idempotency_key": str(key or uuid4()), "lines": [{"menu_item_id": str(item.id), "quantity": qty}],
            **extra}


def test_get_table_reports_can_order(client, opened):
    r = client.get(BASE)
    assert r.status_code == 200
    assert r.json() == {"code": "M5", "label": None, "status": "occupied", "can_order": True}


def test_unknown_table_is_404(client):
    r = client.get("/api/v1/diner/tables/nope")
    assert r.status_code == 404
    assert set(r.json()) == {"code", "message", "details"}


def test_get_menu_has_no_cost_fields(client, table, taco):
    r = client.get(f"{BASE}/menu")
    assert r.status_code == 200
    [category] = r.json()
    [item] = category["items"]
    assert item["price_cents"] == 4000
    assert "cost" not in r.text


def test_place_order_returns_201_and_daily_number(client, opened, taco):
    r = client.post(f"{BASE}/orders", json=order_body(taco, 2))
    assert r.status_code == 201
    body = r.json()
    assert (body["daily_number"], body["round_number"], body["status"], body["subtotal_cents"]) == (1, 1, "received",
                                                                                                    8000)
    assert set(body) == {"order_id", "daily_number", "round_number", "status", "subtotal_cents"}
    session = client.get(f"{BASE}/session").json()
    assert session["subtotal_cents"] == 8000 and len(session["rounds"]) == 1


def test_session_is_null_before_table_opens(client, table):
    r = client.get(f"{BASE}/session")
    assert r.status_code == 200 and r.json() is None


def test_place_order_on_closed_table_is_403_table_not_open(client, uow, opened, taco, table):
    uow.state.tables[table.id].status = TableStatus.BILL_REQUESTED
    r = client.post(f"{BASE}/orders", json=order_body(taco))
    assert r.status_code == 403
    assert r.json()["code"] == "table_not_open"


def test_place_order_unavailable_is_409_with_lines(client, uow, opened):
    gone = uow.seed_item(make_item("Pozole", is_available=False))
    r = client.post(f"{BASE}/orders", json=order_body(gone))
    assert r.status_code == 409
    assert r.json()["code"] == "item_unavailable"
    assert r.json()["details"]["lines"][0]["index"] == 0


def test_price_changed_is_409(client, opened, taco):
    r = client.post(f"{BASE}/orders", json=order_body(taco, expected_total_cents=1))
    assert r.status_code == 409
    assert r.json()["code"] == "price_changed"


def test_invalid_customization_is_422(client, opened, taco):
    body = order_body(taco)
    body["lines"][0]["removed_ingredient_ids"] = [str(uuid4())]
    r = client.post(f"{BASE}/orders", json=body)
    assert r.status_code == 422
    assert r.json()["code"] == "invalid_customization"


def test_place_order_rejects_quantity_zero(client, opened, taco):
    r = client.post(f"{BASE}/orders", json=order_body(taco, 0))
    assert r.status_code == 422
    assert r.json()["code"] == "validation_error"
    assert r.json()["details"]["errors"]


def test_same_idempotency_key_returns_same_order(client, opened, taco):
    key = uuid4()
    first = client.post(f"{BASE}/orders", json=order_body(taco, key=key)).json()
    second = client.post(f"{BASE}/orders", json=order_body(taco, key=key))
    assert second.status_code == 201 and second.json() == first


def test_concurrent_duplicate_key_returns_winner(client, uow, opened, taco):
    key = uuid4()
    winner = client.post(f"{BASE}/orders", json=order_body(taco, key=key)).json()
    real_lookup, real_add = uow.orders.get_by_idempotency_key, uow.orders.add
    calls = {"n": 0}

    def lookup(k):
        calls["n"] += 1
        return None if calls["n"] == 1 else real_lookup(k)

    def add(order):
        if real_lookup(order.idempotency_key):
            raise IntegrityError("insert into orders", {}, Exception("duplicate key"))
        real_add(order)

    uow.orders.get_by_idempotency_key, uow.orders.add = lookup, add
    r = client.post(f"{BASE}/orders", json=order_body(taco, key=key))
    assert r.status_code == 201 and r.json() == winner


def test_eleventh_order_in_a_minute_is_429(client, opened, taco):
    for _ in range(10):
        assert client.post(f"{BASE}/orders", json=order_body(taco)).status_code == 201
    r = client.post(f"{BASE}/orders", json=order_body(taco))
    assert r.status_code == 429
    assert r.json()["code"] == "rate_limited"


def test_nul_in_note_is_422(client, opened, taco):
    body = order_body(taco)
    body["lines"][0]["note"] = "sin\u0000sal"
    r = client.post(f"{BASE}/orders", json=body)
    assert r.status_code == 422 and r.json()["code"] == "validation_error"


def test_malformed_qr_token_is_422(client):
    r = client.get("/api/v1/diner/tables/abc%00def")
    assert r.status_code == 422 and r.json()["code"] == "validation_error"
