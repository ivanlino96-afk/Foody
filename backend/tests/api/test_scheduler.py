from datetime import timedelta

from app.domain.enums import TableStatus
from app.infrastructure.scheduler import run_release_job
from tests.fakes import T0, FixedClock, InMemoryUnitOfWork


def test_run_release_job_frees_expired_tables():
    uow, clock = InMemoryUnitOfWork(), FixedClock()
    old = uow.seed_table(code="M1", status=TableStatus.CLOSED, changed_at=T0 - timedelta(minutes=6))
    fresh = uow.seed_table(code="M2", status=TableStatus.CLOSED, changed_at=T0 - timedelta(minutes=2))
    uow.state.auto_release_minutes = 5
    assert run_release_job(lambda: uow, clock, lambda u: u.settings.auto_release_minutes()) == 1
    assert uow.state.tables[old.id].status == TableStatus.FREE
    assert uow.state.tables[fresh.id].status == TableStatus.CLOSED


def test_run_release_job_survives_errors():
    def broken():
        raise RuntimeError("db down")

    assert run_release_job(broken, FixedClock(), lambda u: 5) == 0
