from typing import Self

from sqlalchemy import Connection, Engine

from app.infrastructure.db.repositories import (
    SqlHistoryRepository,
    SqlMenuRepository,
    SqlOrderRepository,
    SqlSessionRepository,
    SqlSettingsRepository,
    SqlStaffRepository,
    SqlTableRepository,
)


class SqlUnitOfWork:
    """One connection and transaction per `with` block; leaving without commit rolls back."""

    def __init__(self, engine: Engine) -> None:
        self._engine = engine
        self._conn: Connection | None = None

    def __enter__(self) -> Self:
        self._conn = self._engine.connect()
        self.tables = SqlTableRepository(self._conn)
        self.sessions = SqlSessionRepository(self._conn)
        self.menu = SqlMenuRepository(self._conn)
        self.orders = SqlOrderRepository(self._conn)
        self.history = SqlHistoryRepository(self._conn)
        self.staff = SqlStaffRepository(self._conn)
        self.settings = SqlSettingsRepository(self._conn)
        return self

    def __exit__(self, *exc: object) -> None:
        assert self._conn is not None
        try:
            self._conn.rollback()
        finally:
            self._conn.close()
            self._conn = None

    def commit(self) -> None:
        assert self._conn is not None
        self._conn.commit()

    def rollback(self) -> None:
        assert self._conn is not None
        self._conn.rollback()
