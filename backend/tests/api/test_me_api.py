from tests.api.conftest import auth


def test_me_returns_role(client, waiter):
    r = client.get("/api/v1/me", headers=auth(waiter))
    assert r.status_code == 200
    assert r.json() == {"id": str(waiter.id), "full_name": waiter.full_name, "role": "waiter"}


def test_me_requires_token(client):
    assert client.get("/api/v1/me").status_code == 401


def test_waiter_can_read_kitchen_orders(client, waiter):
    assert client.get("/api/v1/kitchen/orders", headers=auth(waiter)).status_code == 200


def test_waiter_cannot_change_kitchen_status(client, waiter):
    r = client.post("/api/v1/kitchen/orders/00000000-0000-0000-0000-000000000001/status", headers=auth(waiter),
                    json={"status": "preparing"})
    assert r.status_code == 403
