from datetime import date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.application.dto import DashboardView, HourSales
from app.application.ports import UnitOfWork
from app.domain.enums import OrderStatus

ORDERS_HISTORY_LIMIT = 500


def day_window(first: date, last: date, timezone: str) -> tuple[datetime, datetime]:
    """Local midnight of `first` to local midnight after `last`."""
    tz = ZoneInfo(timezone)
    return datetime.combine(first, time(), tz), datetime.combine(last + timedelta(days=1), time(), tz)


def list_orders_history(uow: UnitOfWork, first: date, last: date, timezone: str, status: OrderStatus | None = None,
                        table_code: str | None = None) -> list[dict]:
    start, end = day_window(first, last, timezone)
    with uow:
        return uow.reports.orders_history(start, end, status, table_code, ORDERS_HISTORY_LIMIT)


def _avg_seconds(deltas: list[timedelta]) -> int | None:
    return round(sum(d.total_seconds() for d in deltas) / len(deltas)) if deltas else None


def get_dashboard(uow: UnitOfWork, day: date, timezone: str) -> DashboardView:
    start, end = day_window(day, day, timezone)
    tz = ZoneInfo(timezone)
    with uow:
        payments = uow.reports.approved_payments(start, end)
        paid_sessions, paid_cost = uow.reports.paid_sessions(start, end)
        orders = uow.reports.orders_created(start, end)
        occupied, total = uow.reports.table_counts()
    sales = sum(amount for amount, _, _ in payments)
    by_hour = [0] * 24
    for amount, _, paid_at in payments:
        by_hour[paid_at.astimezone(tz).hour] += amount
    live = [o for o in orders if o.status != OrderStatus.CANCELLED]
    cancelled = [o for o in orders if o.status == OrderStatus.CANCELLED]
    profit = sales - paid_cost
    return DashboardView(
        sales_cents=sales,
        tips_cents=sum(tip for _, tip, _ in payments),
        profit_cents=profit,
        margin_pct=round(profit * 100 / sales, 1) if sales else 0,
        orders_count=len(live),
        cancelled_count=len(cancelled),
        cancel_reasons=[o.cancel_reason for o in cancelled if o.cancel_reason],
        avg_ticket_cents=round(sales / paid_sessions) if paid_sessions else 0,
        avg_prep_seconds=_avg_seconds([o.ready_at - o.created_at for o in live if o.ready_at]),
        avg_delivery_seconds=_avg_seconds([o.served_at - o.ready_at for o in live if o.served_at and o.ready_at]),
        occupied_tables=occupied,
        total_tables=total,
        sales_by_hour=[HourSales(h, cents) for h, cents in enumerate(by_hour)],
    )


def get_settings(uow: UnitOfWork) -> dict:
    with uow:
        return uow.settings.get()


def update_settings(uow: UnitOfWork, values: dict, staff_id) -> dict:
    with uow:
        uow.settings.update(values, staff_id)
        current = uow.settings.get()
        uow.commit()
        return current
