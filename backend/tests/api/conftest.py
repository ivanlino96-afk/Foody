from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient

from app.domain.enums import StaffRole
from app.infrastructure.config import Settings
from app.main import create_app
from app.presentation.deps import get_clock, get_uow
from tests.fakes import FixedClock, InMemoryUnitOfWork

JWT_SECRET = "test-secret-with-at-least-32-characters!!"


def make_token(sub, expires_in: timedelta = timedelta(hours=1)) -> str:
    payload = {"sub": str(sub), "aud": "authenticated", "role": "authenticated",
               "exp": datetime.now(UTC) + expires_in}
    return jwt.encode(payload, JWT_SECRET, algorithm="HS256")


def auth(member) -> dict[str, str]:
    return {"Authorization": f"Bearer {make_token(member.id)}"}


@pytest.fixture
def uow() -> InMemoryUnitOfWork:
    return InMemoryUnitOfWork()


@pytest.fixture
def clock() -> FixedClock:
    return FixedClock()


@pytest.fixture
def app(uow, clock):
    application = create_app(Settings(database_url="sqlite://", supabase_url="http://supabase.test",
                                      supabase_jwt_secret=JWT_SECRET, enable_scheduler=False))
    application.dependency_overrides[get_uow] = lambda: uow
    application.dependency_overrides[get_clock] = lambda: clock
    return application


@pytest.fixture
def client(app) -> TestClient:
    return TestClient(app)


@pytest.fixture
def kitchen(uow):
    return uow.seed_staff(StaffRole.KITCHEN)


@pytest.fixture
def waiter(uow):
    return uow.seed_staff(StaffRole.WAITER)


@pytest.fixture
def admin(uow):
    return uow.seed_staff(StaffRole.ADMIN)
