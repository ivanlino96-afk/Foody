import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

pytestmark = pytest.mark.integration

CORE_TABLES = {
    "staff", "restaurant_settings", "dining_tables", "table_sessions", "table_status_history", "categories",
    "menu_items", "ingredients", "menu_item_ingredients", "extras", "menu_item_extras", "availability_log",
    "orders", "order_items", "order_item_extras", "order_item_removed_ingredients", "order_status_history",
    "payments", "payment_webhook_events", "service_calls", "daily_counters",
}


def test_core_tables_exist(conn):
    names = {r[0] for r in conn.execute(text(
        "select table_name from information_schema.tables where table_schema = 'public'"))}
    assert CORE_TABLES <= names


def test_rls_enabled_everywhere(conn):
    rows = conn.execute(text(
        "select relname from pg_class c join pg_namespace n on n.oid = c.relnamespace "
        "where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity")).all()
    assert rows == []


def test_anon_cannot_read_orders(anon_conn):
    assert anon_conn.execute(text("select count(*) from dining_tables")).scalar() == 0


def test_settings_defaults(conn):
    row = conn.execute(text("select auto_release_minutes, tip_options, timezone, currency from restaurant_settings")).one()
    assert tuple(row) == (5, [10, 15, 20], "America/Mexico_City", "MXN")


def test_quantity_check(conn):
    item_id = conn.execute(text("select id from menu_items limit 1")).scalar()
    table = conn.execute(text("select id from dining_tables limit 1")).scalar()
    session = conn.execute(text("insert into table_sessions (table_id) values (:t) returning id"), {"t": table}).scalar()
    order = conn.execute(text(
        "insert into orders (session_id, table_id, daily_number, round_number, status, idempotency_key, "
        "subtotal_cents, cost_cents) values (:s, :t, 1, 1, 'received', gen_random_uuid(), 0, 0) returning id"),
        {"s": session, "t": table}).scalar()
    with pytest.raises(IntegrityError):
        conn.execute(text(
            "insert into order_items (order_id, menu_item_id, item_name, unit_price_cents, unit_cost_cents, quantity, "
            "line_total_cents, line_cost_cents) values (:o, :m, 'x', 100, 10, 0, 0, 0)"), {"o": order, "m": item_id})


def test_realtime_publication(conn):
    names = {r[0] for r in conn.execute(text(
        "select tablename from pg_publication_tables where pubname = 'supabase_realtime'"))}
    assert {"orders", "dining_tables", "service_calls", "payments"} <= names


def test_seed_has_demo_data(conn):
    assert conn.execute(text("select count(*) from dining_tables")).scalar() == 6
    assert conn.execute(text("select count(*) from staff")).scalar() == 3
