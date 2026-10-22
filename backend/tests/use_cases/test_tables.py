from datetime import timedelta
from uuid import uuid4

import pytest

from app.application.use_cases.tables import open_table, release_expired_tables, release_table, reopen_table
from app.domain.enums import ChangeSource, TableStatus
from app.domain.errors import InvalidTransition, NotFound
from tests.fakes import T0, FixedClock, InMemoryUnitOfWork

STAFF = uuid4()


def test_open_table_creates_session_and_history():
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    table = uow.seed_table()
    session = open_table(uow, clock, table.id, STAFF, guests_count=3)
    saved = uow.tables.get(table.id)
    assert saved.status == TableStatus.OCCUPIED
    assert saved.current_session_id == session.id
    assert saved.status_changed_at == clock.now()
    assert uow.sessions.get(session.id).opened_by == STAFF
    assert uow.sessions.get(session.id).guests_count == 3
    [change] = uow.state.table_history
    assert (change.from_status, change.to_status, change.source, change.changed_by) == (
        "free", "occupied", ChangeSource.STAFF, STAFF)
    assert uow.commits == 1


def test_open_busy_table_fails():
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    table = uow.seed_table(status=TableStatus.OCCUPIED)
    with pytest.raises(InvalidTransition):
        open_table(uow, clock, table.id, STAFF)
    assert uow.commits == 0
    assert uow.state.sessions == {}


def test_reopen_closed_table_starts_new_account():
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    table = uow.seed_table()
    first = open_table(uow, clock, table.id, STAFF)
    uow.state.tables[table.id].status = TableStatus.CLOSED
    second = reopen_table(uow, clock, table.id, STAFF)
    assert second.id != first.id
    assert uow.sessions.get(first.id).closed_at == clock.now()
    assert uow.tables.get(table.id).status == TableStatus.OCCUPIED
    assert uow.tables.get(table.id).current_session_id == second.id


def test_release_table_frees_and_closes_session():
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    table = uow.seed_table()
    session = open_table(uow, clock, table.id, STAFF)
    uow.state.tables[table.id].status = TableStatus.CLOSED
    release_table(uow, clock, table.id, STAFF)
    saved = uow.tables.get(table.id)
    assert (saved.status, saved.current_session_id) == (TableStatus.FREE, None)
    assert uow.sessions.get(session.id).closed_at == clock.now()


def test_release_expired_tables_only_after_minutes():
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    old = uow.seed_table(code="M1", status=TableStatus.CLOSED, changed_at=T0 - timedelta(minutes=6))
    recent = uow.seed_table(code="M2", status=TableStatus.CLOSED, changed_at=T0 - timedelta(minutes=2))
    assert release_expired_tables(uow, clock, auto_release_minutes=5) == 1
    assert uow.tables.get(old.id).status == TableStatus.FREE
    assert uow.tables.get(recent.id).status == TableStatus.CLOSED
    assert uow.state.table_history[-1].source == ChangeSource.SYSTEM


def test_unknown_table_raises_not_found():
    with pytest.raises(NotFound):
        open_table(InMemoryUnitOfWork(), FixedClock(), uuid4(), STAFF)


def test_release_job_skips_table_reopened_after_the_scan():
    from datetime import timedelta

    from app.application.use_cases import tables as tables_uc
    from tests.fakes import T0

    uow, clock = InMemoryUnitOfWork(), FixedClock()
    expired = uow.seed_table(code="M1", status=TableStatus.CLOSED, changed_at=T0 - timedelta(minutes=10))
    raced = uow.seed_table(code="M2", status=TableStatus.CLOSED, changed_at=T0 - timedelta(minutes=10))
    real_locked = tables_uc._locked_table

    def locked(u, table_id):
        table = real_locked(u, table_id)
        if table_id == raced.id:  # a waiter reopened it between the scan and the lock
            table.status, table.status_changed_at = TableStatus.OCCUPIED, T0
        return table

    tables_uc._locked_table = locked
    try:
        assert release_expired_tables(uow, clock, 5) == 1
    finally:
        tables_uc._locked_table = real_locked
    assert uow.state.tables[expired.id].status == TableStatus.FREE
    assert uow.state.tables[raced.id].status == TableStatus.OCCUPIED
