from uuid import uuid4

import pytest

from tests.api.conftest import auth
from tests.fakes import make_item


@pytest.fixture
def m1(uow):
    return uow.seed_table(code="M1", qr_token="qr-m1")


@pytest.fixture
def taco(uow):
    return uow.seed_item(make_item("Taco", price_cents=4000))


def place(client, item):
    body = {"idempotency_key": str(uuid4()), "lines": [{"menu_item_id": str(item.id), "quantity": 1}]}
    r = client.post("/api/v1/diner/tables/qr-m1/orders", json=body)
    assert r.status_code == 201, r.text
    return r.json()["order_id"]


def open_m1(client, waiter, m1):
    r = client.post(f"/api/v1/waiter/tables/{m1.id}/open", json={"guests_count": 2}, headers=auth(waiter))
    assert r.status_code == 200, r.text
    return r.json()["session_id"]


def table_status(client, waiter, code):
    tables = client.get("/api/v1/waiter/tables", headers=auth(waiter)).json()
    return next(t for t in tables if t["code"] == code)["status"]


def test_full_service_flow(client, waiter, kitchen, m1, taco):
    open_m1(client, waiter, m1)
    order_id = place(client, taco)
    active = client.get("/api/v1/kitchen/orders?status=active", headers=auth(kitchen)).json()
    assert [(o["id"], o["table_code"], o["status"]) for o in active] == [(order_id, "M1", "received")]
    for target in ("preparing", "ready"):
        r = client.post(f"/api/v1/kitchen/orders/{order_id}/status", json={"status": target}, headers=auth(kitchen))
        assert r.status_code == 200 and r.json()["status"] == target
    assert table_status(client, waiter, "M1") == "awaiting_order"
    r = client.post(f"/api/v1/waiter/orders/{order_id}/served", headers=auth(waiter))
    assert r.status_code == 200 and r.json()["status"] == "served"
    assert table_status(client, waiter, "M1") == "served"
    assert client.get("/api/v1/kitchen/orders?status=active", headers=auth(kitchen)).json() == []


def test_kitchen_token_cannot_open_table(client, kitchen, m1):
    r = client.post(f"/api/v1/waiter/tables/{m1.id}/open", json={}, headers=auth(kitchen))
    assert r.status_code == 403 and r.json()["code"] == "forbidden"


def test_waiter_cannot_move_kitchen_status(client, waiter, m1, taco):
    open_m1(client, waiter, m1)
    order_id = place(client, taco)
    r = client.post(f"/api/v1/kitchen/orders/{order_id}/status", json={"status": "preparing"}, headers=auth(waiter))
    assert r.status_code == 403


def test_ready_twice_is_409(client, waiter, kitchen, m1, taco):
    open_m1(client, waiter, m1)
    order_id = place(client, taco)
    url = f"/api/v1/kitchen/orders/{order_id}/status"
    for target in ("preparing", "ready"):
        client.post(url, json={"status": target}, headers=auth(kitchen))
    r = client.post(url, json={"status": "ready"}, headers=auth(kitchen))
    assert r.status_code == 409 and r.json()["code"] == "invalid_transition"


def test_kitchen_status_body_only_accepts_preparing_or_ready(client, kitchen):
    r = client.post(f"/api/v1/kitchen/orders/{uuid4()}/status", json={"status": "served"}, headers=auth(kitchen))
    assert r.status_code == 422 and r.json()["code"] == "validation_error"


def test_cancel_requires_reason_and_frees_round(client, waiter, m1, taco):
    open_m1(client, waiter, m1)
    order_id = place(client, taco)
    url = f"/api/v1/waiter/orders/{order_id}/cancel"
    assert client.post(url, json={"reason": ""}, headers=auth(waiter)).status_code == 422
    r = client.post(url, json={"reason": "Se equivocó de platillo"}, headers=auth(waiter))
    assert r.status_code == 200 and r.json()["status"] == "cancelled"
    assert client.get("/api/v1/diner/tables/qr-m1/session").json()["subtotal_cents"] == 0


def test_reopen_and_release(client, uow, waiter, m1):
    first = open_m1(client, waiter, m1)
    m1_state = uow.state.tables[m1.id]
    m1_state.status = type(m1_state.status)("closed")
    r = client.post(f"/api/v1/waiter/tables/{m1.id}/reopen", headers=auth(waiter))
    assert r.status_code == 200 and r.json()["session_id"] != first
    assert table_status(client, waiter, "M1") == "occupied"
    m1_state = uow.state.tables[m1.id]
    m1_state.status = type(m1_state.status)("closed")
    r = client.post(f"/api/v1/waiter/tables/{m1.id}/release", headers=auth(waiter))
    assert r.status_code == 204
    assert table_status(client, waiter, "M1") == "free"


def test_unknown_table_is_404(client, waiter):
    r = client.post(f"/api/v1/waiter/tables/{uuid4()}/open", json={}, headers=auth(waiter))
    assert r.status_code == 404
