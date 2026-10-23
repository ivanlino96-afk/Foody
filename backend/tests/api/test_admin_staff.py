from uuid import UUID, uuid4

import pytest

from app.domain.enums import StaffRole
from app.presentation.deps import get_auth_admin
from tests.api.conftest import auth


class FakeAuthAdmin:
    def __init__(self):
        self.created = []

    def create_user(self, email, password):
        self.created.append((email, password))
        return uuid4()


@pytest.fixture
def auth_admin(app):
    fake = FakeAuthAdmin()
    app.dependency_overrides[get_auth_admin] = lambda: fake
    return fake


def test_create_staff_calls_auth_admin(client, admin, uow, auth_admin):
    r = client.post("/api/v1/admin/staff", headers=auth(admin),
                    json={"email": "ana@foody.mx", "password": "secreto123", "full_name": "Ana", "role": "waiter"})
    assert r.status_code == 201, r.text
    assert auth_admin.created == [("ana@foody.mx", "secreto123")]
    member = uow.state.staff[UUID(r.json()["id"])]
    assert (member.full_name, member.role, member.is_active) == ("Ana", StaffRole.WAITER, True)
    assert "password" not in r.json()


def test_create_staff_rejects_short_password(client, admin, auth_admin):
    r = client.post("/api/v1/admin/staff", headers=auth(admin),
                    json={"email": "ana@foody.mx", "password": "corta", "full_name": "Ana", "role": "waiter"})
    assert r.status_code == 422 and auth_admin.created == []


def test_admin_cannot_deactivate_self(client, admin, uow):
    for body in ({"is_active": False}, {"role": "kitchen"}):
        r = client.patch(f"/api/v1/admin/staff/{admin.id}", headers=auth(admin), json=body)
        assert r.status_code == 409, r.text
        assert r.json()["code"] == "invalid_transition"
    assert uow.state.staff[admin.id].is_active and uow.state.staff[admin.id].role == StaffRole.ADMIN


def test_admin_updates_other_staff(client, admin, waiter, uow):
    r = client.patch(f"/api/v1/admin/staff/{waiter.id}", headers=auth(admin), json={"is_active": False})
    assert r.status_code == 200 and r.json()["is_active"] is False
    assert not uow.state.staff[waiter.id].is_active
    assert client.patch(f"/api/v1/admin/staff/{uuid4()}", headers=auth(admin), json={"full_name": "X"}).status_code == 404


def test_staff_routes_need_admin(client, waiter):
    assert client.get("/api/v1/admin/staff", headers=auth(waiter)).status_code == 403


def test_create_staff_without_service_role_is_503(client, admin):
    r = client.post("/api/v1/admin/staff", headers=auth(admin),
                    json={"email": "ana@foody.mx", "password": "secreto123", "full_name": "Ana", "role": "waiter"})
    assert r.status_code == 503 and r.json()["code"] == "service_unavailable"
