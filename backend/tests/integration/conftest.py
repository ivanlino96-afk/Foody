import os

import pytest
from sqlalchemy import create_engine, text

DATABASE_URL = os.environ.get("DATABASE_URL", "postgresql+psycopg://postgres:postgres@127.0.0.1:54322/postgres")


@pytest.fixture(scope="session")
def engine():
    eng = create_engine(DATABASE_URL, pool_pre_ping=True)
    yield eng
    eng.dispose()


@pytest.fixture
def conn(engine):
    with engine.connect() as connection:
        tx = connection.begin()
        yield connection
        tx.rollback()


@pytest.fixture
def anon_conn(conn):
    conn.execute(text("set local role anon"))
    return conn


RESET_ACTIVITY_SQL = (
    "update dining_tables set status = 'free', current_session_id = null; delete from availability_log; "
    "delete from service_calls; delete from payments; delete from order_status_history; "
    "delete from table_status_history; delete from orders; delete from table_sessions; delete from daily_counters")
ADMIN_ID = "11111111-1111-1111-1111-111111111111"
WAITER_ID = "33333333-3333-3333-3333-333333333333"
LOCAL_JWT_SECRET = "super-secret-jwt-token-with-at-least-32-characters-long"


def staff_headers(staff_id: str) -> dict[str, str]:
    from datetime import UTC, datetime, timedelta

    import jwt

    token = jwt.encode({"sub": staff_id, "aud": "authenticated", "exp": datetime.now(UTC) + timedelta(hours=1)},
                       LOCAL_JWT_SECRET, algorithm="HS256")
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def api(engine):
    """TestClient on the real database; removes rows whose name or code starts with the test prefix."""
    from fastapi.testclient import TestClient

    from app.infrastructure.config import Settings
    from app.main import create_app

    app = create_app(Settings(database_url=DATABASE_URL, supabase_url="http://127.0.0.1:54321",
                              supabase_jwt_secret=LOCAL_JWT_SECRET, enable_scheduler=False))
    with TestClient(app) as client:
        client.app_ref = app
        yield client
    with engine.begin() as c:
        c.execute(text(RESET_ACTIVITY_SQL))
        c.execute(text(
            "delete from menu_item_extras where menu_item_id in (select id from menu_items where name like 'zz %');"
            "delete from menu_item_ingredients where menu_item_id in (select id from menu_items where name like 'zz %');"
            "delete from menu_items where name like 'zz %'; delete from categories where name like 'zz %';"
            "delete from extras where name like 'zz %'; delete from ingredients where name like 'zz %';"
            "delete from dining_tables where code like 'ZZ%'"))


@pytest.fixture
def admin_headers():
    return staff_headers(ADMIN_ID)
