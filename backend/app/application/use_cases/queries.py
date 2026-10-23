from uuid import UUID

from app.application.dto import (
    DinerExtraView,
    DinerIngredientView,
    DinerMenuCategoryView,
    DinerMenuItemView,
    DinerRoundView,
    DinerSessionView,
    DinerTableView,
    KitchenOrderView,
    OrderLineView,
    TableMapView,
)
from app.application.ports import UnitOfWork
from app.domain.entities import DiningTable, MenuItem, Order
from app.domain.enums import OrderStatus, ServiceCallType, TableStatus
from app.domain.errors import NotFound
from app.domain.services.availability import extra_available, item_availability
from app.domain.services.billing import balance_cents
from app.domain.services.pricing import PricedLine
from app.domain.services.table_state_machine import can_order


def _table_by_qr(uow: UnitOfWork, qr_token: str):
    table = uow.tables.get_by_qr(qr_token)
    if table is None:
        raise NotFound(details={"qr_token": qr_token})
    return table


def _line_view(line: PricedLine) -> OrderLineView:
    extras = [e.name if e.quantity == 1 else f"{e.quantity}× {e.name}" for e in line.extras]
    return OrderLineView(line.item_name, line.quantity, line.note, extras, [r.name for r in line.removed],
                         line.line_total_cents)


def _item_view(item: MenuItem) -> DinerMenuItemView:
    availability = item_availability(item)
    return DinerMenuItemView(
        id=item.id,
        name=item.name,
        description=item.description,
        price_cents=item.price_cents,
        photo_path=item.photo_path,
        prep_minutes=item.prep_minutes,
        tags=item.tags,
        available=availability.available,
        unavailable_reason=availability.reason,
        ingredients=[DinerIngredientView(i.ingredient.id, i.ingredient.name, i.is_removable, i.ingredient.is_available)
                     for i in item.ingredients],
        extras=[DinerExtraView(e.extra.id, e.extra.name, e.extra.price_cents, e.max_quantity, extra_available(e.extra))
                for e in item.extras],
    )


def get_diner_table(uow: UnitOfWork, qr_token: str) -> DinerTableView:
    with uow:
        table = _table_by_qr(uow, qr_token)
        return DinerTableView(table.code, table.label, table.status, can_order(table.status))


def get_diner_menu(uow: UnitOfWork) -> list[DinerMenuCategoryView]:
    with uow:
        categories = []
        for category in uow.menu.list_menu():
            items = [_item_view(i) for i in category.items if i.is_active and not i.is_deleted]
            if items:
                categories.append(DinerMenuCategoryView(category.id, category.name, items))
        return categories


def _round_view(order: Order) -> DinerRoundView:
    return DinerRoundView(order.id, order.daily_number, order.round_number, order.status, [_line_view(line) for line in order.lines],
                          order.subtotal_cents, order.created_at)


def _session_view(uow: UnitOfWork, table: DiningTable) -> DinerSessionView | None:
    if table.current_session_id is None:
        return None
    session = uow.sessions.get(table.current_session_id)
    if session is None or session.closed_at is not None:
        return None
    rounds = [_round_view(o) for o in uow.orders.list_by_session(session.id)]
    pending = [t.value for t in ServiceCallType if uow.service_calls.pending_for_session(session.id, t)]
    return DinerSessionView(rounds, session.subtotal_cents, session.tip_cents, session.paid_cents,
                            balance_cents(session), table.status == TableStatus.BILL_REQUESTED, pending)


def get_diner_session(uow: UnitOfWork, qr_token: str) -> DinerSessionView | None:
    with uow:
        return _session_view(uow, _table_by_qr(uow, qr_token))


def get_table_account(uow: UnitOfWork, table_id: UUID) -> DinerSessionView | None:
    """The open account of a table for staff: every round with its lines, served ones included."""
    with uow:
        table = uow.tables.get(table_id)
        if table is None:
            raise NotFound(details={"table_id": str(table_id)})
        return _session_view(uow, table)


def get_active_orders(uow: UnitOfWork) -> list[KitchenOrderView]:
    with uow:
        orders = uow.orders.list_by_status([OrderStatus.RECEIVED, OrderStatus.PREPARING, OrderStatus.READY])
        codes = {t.id: t.code for t in uow.tables.list_active()}
        return [KitchenOrderView(o.id, o.daily_number, codes.get(o.table_id, "?"), o.round_number, o.status,
                                 o.created_at, [_line_view(line) for line in o.lines])
                for o in sorted(orders, key=lambda o: o.created_at)]


def get_tables_map(uow: UnitOfWork) -> list[TableMapView]:
    with uow:
        views = []
        for table in uow.tables.list_active():
            orders = uow.orders.list_by_session(table.current_session_id) if table.current_session_id else []
            pending = sum(o.status in (OrderStatus.RECEIVED, OrderStatus.PREPARING) for o in orders)
            ready = sum(o.status == OrderStatus.READY for o in orders)
            session = uow.sessions.get(table.current_session_id) if table.current_session_id else None
            calls = sum(uow.service_calls.pending_for_session(session.id, t) is not None
                        for t in ServiceCallType) if session else 0
            served = sum(o.status == OrderStatus.SERVED for o in orders)
            views.append(TableMapView(
                table.id, table.code, table.label, table.zone, table.status, table.status_changed_at, pending, ready,
                session.id if session else None, balance_cents(session) if session else 0, calls, table.capacity,
                table.kind, table.area_id, table.pos_x, table.pos_y, table.rotation,
                session.guests_count if session else None, session.opened_at if session else None,
                session.subtotal_cents if session else 0, served))
        return views
