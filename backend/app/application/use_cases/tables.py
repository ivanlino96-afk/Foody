from datetime import timedelta
from uuid import UUID, uuid4

from app.application.ports import Clock, UnitOfWork
from app.domain.entities import DiningTable, StatusChange, TableSession
from app.domain.enums import ChangeSource, TableEvent, TableStatus
from app.domain.errors import NotFound
from app.domain.services.table_state_machine import next_table_status


def apply_table_event(uow: UnitOfWork, clock: Clock, table: DiningTable, event: TableEvent,
                      source: ChangeSource, staff_id: UUID | None) -> None:
    """Move the table through the state machine and record history if the status changes."""
    target = next_table_status(table.status, event)
    if target == table.status:
        return
    uow.history.add_table_change(StatusChange(table.id, table.current_session_id, table.status.value, target.value,
                                              source, staff_id, clock.now()))
    table.status = target
    table.status_changed_at = clock.now()
    uow.tables.save(table)


def _locked_table(uow: UnitOfWork, table_id: UUID) -> DiningTable:
    table = uow.tables.get_for_update(table_id)
    if table is None:
        raise NotFound(details={"table_id": str(table_id)})
    return table


def _close_current_session(uow: UnitOfWork, clock: Clock, table: DiningTable) -> None:
    if table.current_session_id is None:
        return
    session = uow.sessions.get_for_update(table.current_session_id)
    if session is not None and session.closed_at is None:
        session.closed_at = clock.now()
        uow.sessions.save(session)


def _start_session(uow: UnitOfWork, clock: Clock, table: DiningTable, staff_id: UUID,
                   guests_count: int | None, event: TableEvent) -> TableSession:
    apply_table_event(uow, clock, table, event, ChangeSource.STAFF, staff_id)
    session = TableSession(uuid4(), table.id, staff_id, clock.now(), guests_count)
    uow.sessions.add(session)
    table.current_session_id = session.id
    uow.tables.save(table)
    return session


def open_table(uow: UnitOfWork, clock: Clock, table_id: UUID, staff_id: UUID,
               guests_count: int | None = None) -> TableSession:
    with uow:
        table = _locked_table(uow, table_id)
        session = _start_session(uow, clock, table, staff_id, guests_count, TableEvent.OPEN)
        uow.commit()
        return session


def reopen_table(uow: UnitOfWork, clock: Clock, table_id: UUID, staff_id: UUID,
                 guests_count: int | None = None) -> TableSession:
    with uow:
        table = _locked_table(uow, table_id)
        _close_current_session(uow, clock, table)
        session = _start_session(uow, clock, table, staff_id, guests_count, TableEvent.REOPEN)
        uow.commit()
        return session


def _release(uow: UnitOfWork, clock: Clock, table: DiningTable, source: ChangeSource, staff_id: UUID | None) -> None:
    apply_table_event(uow, clock, table, TableEvent.RELEASE, source, staff_id)
    _close_current_session(uow, clock, table)
    table.current_session_id = None
    uow.tables.save(table)


def release_table(uow: UnitOfWork, clock: Clock, table_id: UUID, staff_id: UUID | None) -> None:
    with uow:
        table = _locked_table(uow, table_id)
        _release(uow, clock, table, ChangeSource.STAFF, staff_id)
        uow.commit()


def release_expired_tables(uow: UnitOfWork, clock: Clock, auto_release_minutes: int) -> int:
    cutoff = clock.now() - timedelta(minutes=auto_release_minutes)
    with uow:
        candidates = [t for t in uow.tables.list_by_status(TableStatus.CLOSED) if t.status_changed_at <= cutoff]
        released = 0
        for candidate in candidates:
            table = _locked_table(uow, candidate.id)
            # Re-check under the lock: a waiter may have reopened it since the scan.
            if table.status != TableStatus.CLOSED or table.status_changed_at > cutoff:
                continue
            _release(uow, clock, table, ChangeSource.SYSTEM, None)
            released += 1
        uow.commit()
        return released
