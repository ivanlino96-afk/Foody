import threading
from uuid import UUID, uuid4

import pytest
from sqlalchemy import text

from app.application.use_cases.place_order import PlaceOrderCommand, place_order
from app.application.use_cases.queries import get_diner_session
from app.application.use_cases.tables import open_table
from app.domain.enums import StaffRole, TableStatus
from app.domain.services.pricing import ExtraRequest, LineRequest
from app.infrastructure.clock import SystemClock
from app.infrastructure.db.unit_of_work import SqlUnitOfWork

pytestmark = pytest.mark.integration

WAITER = UUID("33333333-3333-3333-3333-333333333333")
BOWL = UUID("cccccccc-0000-0000-0000-000000000001")
HUEVO_EXTRA = UUID("dddddddd-0000-0000-0000-000000000002")
CEBOLLA = UUID("bbbbbbbb-0000-0000-0000-000000000003")
QR = "dev-qr-m1-000000000000000000000000"


@pytest.fixture
def clean_db(engine):
    yield
    with engine.begin() as c:
        c.execute(text("update dining_tables set status = 'free', current_session_id = null"))
        c.execute(text("delete from order_status_history; delete from table_status_history; delete from orders; "
                       "delete from table_sessions; delete from daily_counters"))


@pytest.fixture
def uow(engine, clean_db):
    return SqlUnitOfWork(engine)


def table_id(uow) -> UUID:
    with uow:
        return uow.tables.get_by_qr(QR).id


def test_place_order_roundtrip(uow):
    clock = SystemClock("America/Mexico_City")
    open_table(uow, clock, table_id(uow), WAITER)
    order = place_order(uow, clock, PlaceOrderCommand(QR, uuid4(), (
        LineRequest(BOWL, 2, removed_ingredient_ids=(CEBOLLA,), extras=(ExtraRequest(HUEVO_EXTRA, 2),),
                    note="sin picante"),), None))
    with uow:
        saved = uow.orders.get(order.id)
    assert saved.lines == order.lines
    line = saved.lines[0]
    assert [(e.name, e.quantity) for e in line.extras] == [("Huevo pochado", 2)]
    assert [r.name for r in line.removed] == ["Cebolla morada"]
    assert line.line_total_cents == (16500 + 2500 * 2) * 2
    with uow:
        assert uow.tables.get_by_qr(QR).status == TableStatus.AWAITING_ORDER
    assert get_diner_session(uow, QR).subtotal_cents == line.line_total_cents


def test_concurrent_orders_get_distinct_daily_numbers(engine, uow):
    clock = SystemClock("America/Mexico_City")
    session = open_table(uow, clock, table_id(uow), WAITER)
    results, errors = [], []

    def worker():
        try:
            results.append(place_order(SqlUnitOfWork(engine), clock,
                                       PlaceOrderCommand(QR, uuid4(), (LineRequest(BOWL, 1),), None)))
        except Exception as exc:  # noqa: BLE001 - surfaced by the assertion below
            errors.append(exc)

    threads = [threading.Thread(target=worker) for _ in range(2)]
    for t in threads:
        t.start()
    for t in threads:
        t.join()
    assert errors == []
    assert sorted(o.daily_number for o in results) == [1, 2]
    assert sorted(o.round_number for o in results) == [1, 2]
    with uow:
        assert uow.sessions.get(session.id).subtotal_cents == 2 * 16500


def test_menu_repository_loads_extras_with_ingredient(uow):
    with uow:
        item = uow.menu.get_items([BOWL])[BOWL]
        menu = uow.menu.list_menu()
    aguacate = next(e.extra for e in item.extras if e.extra.name == "Aguacate extra")
    assert aguacate.ingredient is not None and aguacate.ingredient.name == "Aguacate"
    assert item.ingredients[0].ingredient.name == "Quinoa"
    assert [c.name for c in menu] == ["Bowls", "Sándwiches", "Jugos"]


def test_staff_and_settings(uow):
    with uow:
        assert uow.staff.get(WAITER).role == StaffRole.WAITER
        assert uow.settings.auto_release_minutes() == 5
