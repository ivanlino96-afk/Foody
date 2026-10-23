from sqlalchemy import Boolean, Column, Date, DateTime, FetchedValue, Integer, MetaData, Table, Text
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, UUID

metadata = MetaData()

table_status = ENUM("free", "occupied", "awaiting_order", "served", "bill_requested", "closed",
                    name="table_status", create_type=False)
order_status = ENUM("received", "preparing", "ready", "served", "cancelled", name="order_status", create_type=False)
payment_method = ENUM("mercado_pago", "cash", "card_terminal", name="payment_method", create_type=False)
payment_status = ENUM("pending", "approved", "rejected", "cancelled", "refunded", name="payment_status",
                      create_type=False)
service_call_type = ENUM("call_waiter", "request_bill", name="service_call_type", create_type=False)
availability_entity = ENUM("menu_item", "ingredient", "extra", name="availability_entity", create_type=False)
change_source = ENUM("staff", "diner", "system", "payment", name="change_source", create_type=False)
staff_role = ENUM("admin", "kitchen", "waiter", name="staff_role", create_type=False)


def _uuid(name: str, **kw) -> Column:
    if kw.get("primary_key"):
        kw.setdefault("server_default", FetchedValue())
    return Column(name, UUID(as_uuid=True), **kw)


staff = Table("staff", metadata, _uuid("id", primary_key=True), Column("full_name", Text),
              Column("role", staff_role), Column("is_active", Boolean))

restaurant_settings = Table("restaurant_settings", metadata, _uuid("id", primary_key=True),
                            Column("auto_release_minutes", Integer))

dining_tables = Table(
    "dining_tables", metadata, _uuid("id", primary_key=True), Column("code", Text), Column("label", Text),
    Column("zone", Text), Column("capacity", Integer), Column("qr_token", Text), Column("status", table_status),
    _uuid("current_session_id"), Column("status_changed_at", DateTime(timezone=True)),
    Column("sort_order", Integer), Column("deleted_at", DateTime(timezone=True)),
)

table_sessions = Table(
    "table_sessions", metadata, _uuid("id", primary_key=True), _uuid("table_id"), _uuid("opened_by"),
    Column("guests_count", Integer), Column("opened_at", DateTime(timezone=True)),
    Column("closed_at", DateTime(timezone=True)), Column("subtotal_cents", Integer), Column("cost_cents", Integer),
    Column("tip_cents", Integer), Column("paid_cents", Integer), Column("bill_requested_at", DateTime(timezone=True)),
    Column("paid_at", DateTime(timezone=True)),
)

table_status_history = Table(
    "table_status_history", metadata, _uuid("id", primary_key=True), _uuid("table_id"), _uuid("session_id"),
    Column("from_status", table_status), Column("to_status", table_status), Column("source", change_source),
    _uuid("changed_by"), Column("changed_at", DateTime(timezone=True)),
)

categories = Table("categories", metadata, _uuid("id", primary_key=True), Column("name", Text),
                   Column("description", Text), Column("sort_order", Integer), Column("is_active", Boolean),
                   Column("deleted_at", DateTime(timezone=True)), _uuid("created_by"), _uuid("updated_by"))

menu_items = Table(
    "menu_items", metadata, _uuid("id", primary_key=True), _uuid("category_id"), Column("name", Text),
    Column("description", Text), Column("price_cents", Integer), Column("cost_cents", Integer),
    Column("photo_path", Text), Column("is_available", Boolean), Column("prep_minutes", Integer),
    Column("tags", ARRAY(Text)), Column("sort_order", Integer), Column("is_active", Boolean),
    Column("deleted_at", DateTime(timezone=True)), _uuid("created_by"), _uuid("updated_by"),
)

ingredients = Table("ingredients", metadata, _uuid("id", primary_key=True), Column("name", Text),
                    Column("is_available", Boolean), Column("deleted_at", DateTime(timezone=True)),
                    _uuid("created_by"), _uuid("updated_by"))

menu_item_ingredients = Table("menu_item_ingredients", metadata, _uuid("menu_item_id"), _uuid("ingredient_id"),
                              Column("is_removable", Boolean), Column("sort_order", Integer))

extras = Table("extras", metadata, _uuid("id", primary_key=True), Column("name", Text),
               Column("price_cents", Integer), Column("cost_cents", Integer), _uuid("ingredient_id"),
               Column("is_available", Boolean), Column("deleted_at", DateTime(timezone=True)),
               _uuid("created_by"), _uuid("updated_by"))

menu_item_extras = Table("menu_item_extras", metadata, _uuid("menu_item_id"), _uuid("extra_id"),
                         Column("max_quantity", Integer), Column("sort_order", Integer))

daily_counters = Table("daily_counters", metadata, Column("day", Date, primary_key=True),
                       Column("last_number", Integer))

orders = Table(
    "orders", metadata, _uuid("id", primary_key=True), _uuid("session_id"), _uuid("table_id"),
    Column("daily_number", Integer), Column("round_number", Integer), Column("status", order_status),
    _uuid("idempotency_key"), Column("subtotal_cents", Integer), Column("cost_cents", Integer),
    Column("created_at", DateTime(timezone=True)), Column("preparing_at", DateTime(timezone=True)),
    Column("ready_at", DateTime(timezone=True)), Column("served_at", DateTime(timezone=True)),
    Column("cancelled_at", DateTime(timezone=True)), _uuid("cancelled_by"), Column("cancel_reason", Text),
)

order_items = Table(
    "order_items", metadata, _uuid("id", primary_key=True), _uuid("order_id"), Column("position", Integer),
    _uuid("menu_item_id"), Column("item_name", Text), Column("unit_price_cents", Integer),
    Column("unit_cost_cents", Integer), Column("quantity", Integer), Column("note", Text),
    Column("line_total_cents", Integer), Column("line_cost_cents", Integer),
)

order_item_extras = Table(
    "order_item_extras", metadata, _uuid("id", primary_key=True), _uuid("order_item_id"), Column("position", Integer),
    _uuid("extra_id"), Column("extra_name", Text), Column("unit_price_cents", Integer), Column("unit_cost_cents", Integer),
    Column("quantity", Integer),
)

order_item_removed_ingredients = Table(
    "order_item_removed_ingredients", metadata, _uuid("id", primary_key=True), _uuid("order_item_id"),
    Column("position", Integer), _uuid("ingredient_id"), Column("ingredient_name", Text),
)

order_status_history = Table(
    "order_status_history", metadata, _uuid("id", primary_key=True), _uuid("order_id"),
    Column("from_status", order_status), Column("to_status", order_status), Column("source", change_source),
    _uuid("changed_by"), Column("changed_at", DateTime(timezone=True)),
)

payments = Table(
    "payments", metadata, _uuid("id", primary_key=True), _uuid("session_id"), Column("method", payment_method),
    Column("status", payment_status), Column("amount_cents", Integer), Column("tip_cents", Integer),
    _uuid("received_by"), Column("paid_at", DateTime(timezone=True)), Column("created_at", DateTime(timezone=True)),
    _uuid("created_by"),
)

service_calls = Table(
    "service_calls", metadata, _uuid("id", primary_key=True), _uuid("session_id"), _uuid("table_id"),
    Column("type", service_call_type), Column("created_at", DateTime(timezone=True)),
    Column("attended_at", DateTime(timezone=True)), _uuid("attended_by"),
)

availability_log = Table(
    "availability_log", metadata, _uuid("id", primary_key=True), Column("entity_type", availability_entity),
    _uuid("entity_id"), Column("is_available", Boolean), _uuid("changed_by"),
    Column("changed_at", DateTime(timezone=True)), _uuid("created_by"),
)
