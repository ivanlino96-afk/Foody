from datetime import datetime
from uuid import uuid4
from zoneinfo import ZoneInfo

import pytest

from app.presentation.deps import get_clock
from tests.fakes import FixedClock
from tests.integration.conftest import WAITER_ID, staff_headers

pytestmark = pytest.mark.integration

A = "/api/v1/admin"
QR = "dev-qr-m1-000000000000000000000000"
KITCHEN_ID = "22222222-2222-2222-2222-222222222222"
DAY = "2031-01-15"


@pytest.fixture
def fixed_clock(api):
    clock = FixedClock(datetime(2031, 1, 15, 18, 0, tzinfo=ZoneInfo("America/Mexico_City")))
    api.app_ref.dependency_overrides[get_clock] = lambda: clock
    yield clock
    api.app_ref.dependency_overrides.pop(get_clock, None)


def make_dish(api, h, price=16500, cost=5200):
    cat = api.post(f"{A}/categories", json={"name": "zz Fuertes"}, headers=h).json()
    r = api.post(f"{A}/menu-items", json={"category_id": cat["id"], "name": "zz Parrillada", "price_cents": price,
                                         "cost_cents": cost}, headers=h)
    assert r.status_code == 201, r.text
    return r.json()


def m1_id(api, h):
    return next(t["id"] for t in api.get(f"{A}/tables", headers=h).json() if t["code"] == "M1")


def place_order(api, dish_id):
    r = api.post(f"/api/v1/diner/tables/{QR}/orders",
                 json={"idempotency_key": str(uuid4()), "lines": [{"menu_item_id": dish_id, "quantity": 1}]})
    assert r.status_code == 201, r.text
    return r.json()["order_id"]


def serve(api, order_id):
    kitchen = staff_headers(KITCHEN_ID)
    for s in ("preparing", "ready"):
        assert api.post(f"/api/v1/kitchen/orders/{order_id}/status", json={"status": s},
                        headers=kitchen).status_code == 200
    assert api.post(f"/api/v1/waiter/orders/{order_id}/served", headers=staff_headers(WAITER_ID)).status_code == 200


def test_dashboard_counts_one_paid_session(api, admin_headers, fixed_clock):
    waiter = staff_headers(WAITER_ID)
    dish = make_dish(api, admin_headers)
    session = api.post(f"/api/v1/waiter/tables/{m1_id(api, admin_headers)}/open", json={}, headers=waiter).json()
    order_id = place_order(api, dish["id"])
    fixed_clock.advance(minutes=10)
    serve(api, order_id)
    r = api.post(f"/api/v1/waiter/sessions/{session['session_id']}/payments",
                 json={"method": "cash", "amount_cents": 16500, "tip_cents": 2000}, headers=waiter)
    assert r.status_code == 201, r.text

    d = api.get(f"{A}/dashboard", params={"date": DAY}, headers=admin_headers)
    assert d.status_code == 200, d.text
    d = d.json()
    assert (d["sales_cents"], d["tips_cents"], d["profit_cents"], d["margin_pct"]) == (16500, 2000, 11300, 68.5)
    assert (d["orders_count"], d["cancelled_count"], d["avg_ticket_cents"]) == (1, 0, 16500)
    assert len(d["sales_by_hour"]) == 24 and d["sales_by_hour"][18] == {"hour": 18, "sales_cents": 16500}
    assert d["total_tables"] >= 1 and d["occupied_tables"] >= 1
    assert d["avg_prep_seconds"] == 600 and d["avg_delivery_seconds"] == 0

    empty = api.get(f"{A}/dashboard", params={"date": "2031-01-14"}, headers=admin_headers).json()
    assert (empty["sales_cents"], empty["margin_pct"], empty["avg_prep_seconds"]) == (0, 0, None)


def test_orders_history_filters_by_status(api, admin_headers, fixed_clock):
    waiter = staff_headers(WAITER_ID)
    dish = make_dish(api, admin_headers)
    api.post(f"/api/v1/waiter/tables/{m1_id(api, admin_headers)}/open", json={}, headers=waiter)
    first = place_order(api, dish["id"])
    fixed_clock.advance(minutes=1)
    place_order(api, dish["id"])
    assert api.post(f"/api/v1/waiter/orders/{first}/cancel", json={"reason": "Se arrepintió"},
                    headers=waiter).status_code == 200

    rows = api.get(f"{A}/orders", params={"from": DAY, "to": DAY}, headers=admin_headers).json()
    assert [r["round_number"] for r in rows] == [2, 1]
    assert rows[0]["table_code"] == "M1" and rows[0]["subtotal_cents"] == 16500 and rows[0]["cost_cents"] == 5200
    cancelled = api.get(f"{A}/orders", params={"from": DAY, "to": DAY, "status": "cancelled", "table": "M1"},
                        headers=admin_headers).json()
    assert [(r["round_number"], r["cancel_reason"]) for r in cancelled] == [(1, "Se arrepintió")]
    assert api.get(f"{A}/orders", params={"from": "2031-01-16", "to": "2031-01-16"},
                   headers=admin_headers).json() == []
    assert api.get(f"{A}/orders", params={"status": "nope"}, headers=admin_headers).status_code == 422


def test_settings_roundtrip_and_validation(api, admin_headers):
    original = api.get(f"{A}/settings", headers=admin_headers).json()
    try:
        body = {"name": "Foody Centro", "auto_release_minutes": 15, "tip_options": [10, 18]}
        r = api.put(f"{A}/settings", json=body, headers=admin_headers)
        assert r.status_code == 200 and r.json() == body
        assert api.get(f"{A}/settings", headers=admin_headers).json() == body
        for bad in ({**body, "auto_release_minutes": 241}, {**body, "tip_options": []},
                    {**body, "tip_options": [10, 101]}, {**body, "tip_options": [1, 2, 3, 4, 5, 6]}, {**body, "name": ""}):
            assert api.put(f"{A}/settings", json=bad, headers=admin_headers).status_code == 422
    finally:
        api.put(f"{A}/settings", json=original, headers=admin_headers)
    assert api.get(f"{A}/settings", headers=staff_headers(WAITER_ID)).status_code == 403


def test_staff_list_includes_seed_staff_with_email(api, admin_headers):
    rows = api.get(f"{A}/staff", headers=admin_headers).json()
    admin = next(r for r in rows if r["role"] == "admin")
    assert admin["is_active"] and "@" in (admin["email"] or "")
