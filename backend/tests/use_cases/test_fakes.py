from datetime import date

from tests.fakes import FixedClock, InMemoryUnitOfWork, make_table


def test_inmemory_uow_rolls_back_without_commit():
    uow = InMemoryUnitOfWork()
    table = make_table()
    with uow:
        uow.tables.save(table)
    assert uow.tables.get(table.id) is None
    assert uow.commits == 0


def test_inmemory_uow_keeps_committed_changes():
    uow = InMemoryUnitOfWork()
    table = make_table()
    with uow:
        uow.tables.save(table)
        uow.commit()
    assert uow.tables.get(table.id) == table
    assert uow.commits == 1


def test_next_daily_number_increments_per_day():
    uow = InMemoryUnitOfWork()
    assert uow.orders.next_daily_number(date(2026, 10, 22)) == 1
    assert uow.orders.next_daily_number(date(2026, 10, 22)) == 2
    assert uow.orders.next_daily_number(date(2026, 10, 23)) == 1


def test_fixed_clock_business_date_uses_mexico_city():
    clock = FixedClock.at("2026-10-23T03:00:00+00:00")
    assert clock.business_date() == date(2026, 10, 22)
