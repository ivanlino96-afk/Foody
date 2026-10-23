from uuid import uuid4

import pytest

from tests.api.conftest import auth
from tests.fakes import make_item

QR = "qr-m9"
DINER = f"/api/v1/diner/tables/{QR}"


@pytest.fixture
def m9(uow):
    return uow.seed_table(code="M9", qr_token=QR)


@pytest.fixture
def taco(uow):
    return uow.seed_item(make_item("Taco", price_cents=4000))


def open_and_order(client, waiter, m9, taco, qty=2):
    assert client.post(f"/api/v1/waiter/tables/{m9.id}/open", json={}, headers=auth(waiter)).status_code == 200
    body = {"idempotency_key": str(uuid4()), "lines": [{"menu_item_id": str(taco.id), "quantity": qty}]}
    assert client.post(f"{DINER}/orders", json=body).status_code == 201


def m9_row(client, waiter):
    return next(t for t in client.get("/api/v1/waiter/tables", headers=auth(waiter)).json() if t["code"] == "M9")


def test_diner_requests_bill_and_waiter_charges(client, waiter, m9, taco):
    open_and_order(client, waiter, m9, taco)
    r = client.post(f"{DINER}/service-calls", json={"type": "request_bill"})
    assert r.status_code == 201 and r.json()["type"] == "request_bill"
    calls = client.get("/api/v1/waiter/service-calls", headers=auth(waiter)).json()
    assert [(c["table_code"], c["type"]) for c in calls] == [("M9", "request_bill")]
    row = m9_row(client, waiter)
    assert (row["status"], row["balance_cents"], row["pending_calls"]) == ("bill_requested", 8000, 1)
    r = client.post(f"/api/v1/waiter/sessions/{row['session_id']}/payments",
                    json={"method": "cash", "amount_cents": 8000, "tip_cents": 1200}, headers=auth(waiter))
    assert r.status_code == 201
    assert (r.json()["balance_cents"], r.json()["table_status"]) == (0, "closed")
    row = m9_row(client, waiter)
    assert (row["status"], row["pending_calls"]) == ("closed", 0)
    assert client.get("/api/v1/waiter/service-calls", headers=auth(waiter)).json() == []


def test_waiter_requests_bill_for_table(client, waiter, m9, taco):
    open_and_order(client, waiter, m9, taco)
    r = client.post(f"/api/v1/waiter/tables/{m9.id}/request-bill", headers=auth(waiter))
    assert r.status_code == 204
    assert m9_row(client, waiter)["status"] == "bill_requested"
    assert client.get(f"{DINER}/session").json()["bill_requested"] is True


def test_attend_call(client, waiter, m9, taco):
    open_and_order(client, waiter, m9, taco)
    call = client.post(f"{DINER}/service-calls", json={"type": "call_waiter"}).json()
    assert client.post(f"/api/v1/waiter/service-calls/{call['id']}/attend", headers=auth(waiter)).status_code == 204
    assert client.get("/api/v1/waiter/service-calls", headers=auth(waiter)).json() == []


def test_kitchen_cannot_register_payment(client, waiter, kitchen, m9, taco):
    open_and_order(client, waiter, m9, taco)
    session_id = m9_row(client, waiter)["session_id"]
    r = client.post(f"/api/v1/waiter/sessions/{session_id}/payments", json={"method": "cash", "amount_cents": 1},
                    headers=auth(kitchen))
    assert r.status_code == 403


def test_payment_body_validation(client, waiter, m9, taco):
    open_and_order(client, waiter, m9, taco)
    session_id = m9_row(client, waiter)["session_id"]
    for body in ({"method": "cash", "amount_cents": 0}, {"method": "mercado_pago", "amount_cents": 10}):
        r = client.post(f"/api/v1/waiter/sessions/{session_id}/payments", json=body, headers=auth(waiter))
        assert r.status_code == 422 and r.json()["code"] == "validation_error"


def test_call_waiter_from_free_table_is_403(client, m9):
    r = client.post(f"{DINER}/service-calls", json={"type": "call_waiter"})
    assert r.status_code == 403 and r.json()["code"] == "table_not_open"


def test_kitchen_toggles_availability(client, kitchen, m9, taco):
    r = client.patch(f"/api/v1/availability/menu_item/{taco.id}", json={"is_available": False}, headers=auth(kitchen))
    assert r.status_code == 204
    [category] = client.get(f"{DINER}/menu").json()
    assert category["items"][0]["available"] is False


def test_waiter_cannot_toggle_availability(client, waiter, taco):
    r = client.patch(f"/api/v1/availability/menu_item/{taco.id}", json={"is_available": False}, headers=auth(waiter))
    assert r.status_code == 403


def test_unknown_availability_entity_is_422(client, kitchen):
    r = client.patch(f"/api/v1/availability/table/{uuid4()}", json={"is_available": False}, headers=auth(kitchen))
    assert r.status_code == 422
