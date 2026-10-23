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
