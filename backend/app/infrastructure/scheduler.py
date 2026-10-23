import logging
from collections.abc import Callable

from apscheduler.schedulers.background import BackgroundScheduler

from app.application.ports import Clock, UnitOfWork
from app.application.use_cases.tables import release_expired_tables
from app.infrastructure.clock import SystemClock
from app.infrastructure.db.unit_of_work import SqlUnitOfWork

logger = logging.getLogger(__name__)


def run_release_job(uow_factory: Callable[[], UnitOfWork], clock: Clock,
                    read_minutes: Callable[[UnitOfWork], int]) -> int:
    """Frees closed tables past the configured delay; a failure is logged and retried on the next tick."""
    try:
        uow = uow_factory()
        with uow:
            minutes = read_minutes(uow)
        released = release_expired_tables(uow, clock, minutes)
    except Exception:
        logger.exception("auto-release job failed")
        return 0
    if released:
        logger.info("auto-release freed %d table(s)", released)
    return released


def start_scheduler(app_state) -> BackgroundScheduler:
    clock = SystemClock(app_state.settings.timezone)
    scheduler = BackgroundScheduler(timezone=app_state.settings.timezone)
    scheduler.add_job(run_release_job, "interval", seconds=60, max_instances=1, coalesce=True,
                      args=(lambda: SqlUnitOfWork(app_state.engine), clock,
                            lambda uow: uow.settings.auto_release_minutes()))
    scheduler.start()
    return scheduler
