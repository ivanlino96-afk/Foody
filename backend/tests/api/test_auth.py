from datetime import timedelta

import pytest
from fastapi import APIRouter, Depends

from app.domain.enums import StaffRole
from app.presentation.deps import CurrentStaff, require_roles
from tests.api.conftest import auth, make_token


@pytest.fixture
def guarded(app, client):
    router = APIRouter()

    @router.get("/test/waiter-only")
    def waiter_only(staff: CurrentStaff = Depends(require_roles(StaffRole.WAITER))):
        return {"role": staff.role}

    app.include_router(router)
    return client


def test_missing_token_is_401(guarded):
    r = guarded.get("/test/waiter-only")
    assert r.status_code == 401
    assert r.json()["code"] == "unauthorized"


def test_expired_token_is_401(guarded, waiter):
    # 401 tells the app to refresh or sign in again; 403 is kept for "this account may not do this".
    r = guarded.get("/test/waiter-only",
                    headers={"Authorization": f"Bearer {make_token(waiter.id, timedelta(minutes=-5))}"})
    assert r.status_code == 401
    assert r.json()["code"] == "unauthorized"


def test_garbage_token_is_401(guarded):
    r = guarded.get("/test/waiter-only", headers={"Authorization": "Bearer not-a-jwt"})
    assert r.status_code == 401
    assert r.json()["code"] == "unauthorized"


def test_waiter_route_rejects_kitchen_role(guarded, kitchen):
    r = guarded.get("/test/waiter-only", headers=auth(kitchen))
    assert r.status_code == 403
    assert r.json()["code"] == "forbidden"


def test_waiter_route_accepts_waiter(guarded, waiter):
    r = guarded.get("/test/waiter-only", headers=auth(waiter))
    assert r.status_code == 200
    assert r.json() == {"role": "waiter"}


def test_admin_passes_any_role_guard(guarded, admin):
    assert guarded.get("/test/waiter-only", headers=auth(admin)).status_code == 200


def test_inactive_staff_is_403(guarded, uow):
    retired = uow.seed_staff(StaffRole.WAITER, active=False)
    assert guarded.get("/test/waiter-only", headers=auth(retired)).status_code == 403
