from collections import defaultdict
from collections.abc import Iterable
from datetime import date
from uuid import UUID, uuid4

from sqlalchemy import Connection, Row, func, insert, select, update
from sqlalchemy.dialects.postgresql import insert as pg_insert

from app.application.dto import AvailabilityBoardView, AvailabilityRow, MenuCategoryView, StaffMember
from app.domain.entities import (
    DiningTable,
    Extra,
    Ingredient,
    ItemExtra,
    ItemIngredient,
    MenuItem,
    Order,
    Payment,
    ServiceCall,
    StatusChange,
    TableSession,
)
from app.domain.enums import (
    AvailabilityEntity,
    OrderStatus,
    PaymentMethod,
    PaymentStatus,
    ServiceCallType,
    StaffRole,
    TableStatus,
)
from app.domain.services.pricing import PricedExtra, PricedLine, RemovedIngredient
from app.infrastructure.db import tables as t


def _row_to_table(row: Row) -> DiningTable:
    return DiningTable(row.id, row.code, row.label, row.zone, row.capacity, row.qr_token, TableStatus(row.status),
                       row.current_session_id, row.status_changed_at)


def _row_to_session(row: Row) -> TableSession:
    return TableSession(row.id, row.table_id, row.opened_by, row.opened_at, row.guests_count, row.subtotal_cents,
                        row.cost_cents, row.tip_cents, row.paid_cents, row.closed_at, row.bill_requested_at,
                        row.paid_at)


def _row_to_ingredient(row: Row) -> Ingredient:
    return Ingredient(row.id, row.name, row.is_available)


def _row_to_order(row: Row, lines: list[PricedLine]) -> Order:
    return Order(row.id, row.session_id, row.table_id, row.daily_number, row.round_number, OrderStatus(row.status),
                 row.idempotency_key, row.subtotal_cents, row.cost_cents, lines, row.created_at, row.preparing_at,
                 row.ready_at, row.served_at, row.cancelled_at, row.cancelled_by, row.cancel_reason)


class SqlTableRepository:
    _cols = (t.dining_tables.c.id, t.dining_tables.c.code, t.dining_tables.c.label, t.dining_tables.c.zone,
             t.dining_tables.c.capacity, t.dining_tables.c.qr_token, t.dining_tables.c.status,
             t.dining_tables.c.current_session_id, t.dining_tables.c.status_changed_at)

    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def _one(self, stmt) -> DiningTable | None:
        row = self._conn.execute(stmt).first()
        return _row_to_table(row) if row else None

    def _active(self):
        return select(*self._cols).where(t.dining_tables.c.deleted_at.is_(None))

    def get(self, table_id: UUID) -> DiningTable | None:
        return self._one(self._active().where(t.dining_tables.c.id == table_id))

    def get_by_qr(self, qr_token: str) -> DiningTable | None:
        return self._one(self._active().where(t.dining_tables.c.qr_token == qr_token))

    def get_for_update(self, table_id: UUID) -> DiningTable | None:
        return self._one(self._active().where(t.dining_tables.c.id == table_id).with_for_update())

    def list_active(self) -> list[DiningTable]:
        stmt = self._active().order_by(t.dining_tables.c.sort_order, t.dining_tables.c.code)
        return [_row_to_table(r) for r in self._conn.execute(stmt)]

    def list_by_status(self, status: TableStatus) -> list[DiningTable]:
        stmt = self._active().where(t.dining_tables.c.status == status.value).order_by(t.dining_tables.c.code)
        return [_row_to_table(r) for r in self._conn.execute(stmt)]

    def save(self, table: DiningTable) -> None:
        self._conn.execute(update(t.dining_tables).where(t.dining_tables.c.id == table.id).values(
            status=table.status.value, current_session_id=table.current_session_id,
            status_changed_at=table.status_changed_at))


class SqlSessionRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def _one(self, stmt) -> TableSession | None:
        row = self._conn.execute(stmt).first()
        return _row_to_session(row) if row else None

    def get(self, session_id: UUID) -> TableSession | None:
        return self._one(select(t.table_sessions).where(t.table_sessions.c.id == session_id))

    def get_for_update(self, session_id: UUID) -> TableSession | None:
        return self._one(select(t.table_sessions).where(t.table_sessions.c.id == session_id).with_for_update())

    def _values(self, s: TableSession) -> dict:
        return {"table_id": s.table_id, "opened_by": s.opened_by, "opened_at": s.opened_at,
                "guests_count": s.guests_count, "subtotal_cents": s.subtotal_cents, "cost_cents": s.cost_cents,
                "tip_cents": s.tip_cents, "paid_cents": s.paid_cents, "closed_at": s.closed_at,
                "bill_requested_at": s.bill_requested_at, "paid_at": s.paid_at}

    def add(self, session: TableSession) -> None:
        self._conn.execute(insert(t.table_sessions).values(id=session.id, **self._values(session)))

    def save(self, session: TableSession) -> None:
        self._conn.execute(update(t.table_sessions).where(t.table_sessions.c.id == session.id)
                           .values(**self._values(session)))


class SqlMenuRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def get_items(self, ids: Iterable[UUID]) -> dict[UUID, MenuItem]:
        return {item.id: item for item in self._load(list(ids))}

    def _load(self, ids: list[UUID] | None) -> list[MenuItem]:
        """Deleted ingredients and extras come back unavailable (an old cart gets item_unavailable) and are
        dropped from the diner menu; items of a hidden or deleted category come back inactive."""
        mi, mii, ing, mie, ex, cat = (t.menu_items, t.menu_item_ingredients, t.ingredients, t.menu_item_extras,
                                      t.extras, t.categories)
        category_visible = (cat.c.is_active & cat.c.deleted_at.is_(None)).label("category_visible")
        stmt = (select(mi, category_visible).join(cat, cat.c.id == mi.c.category_id)
                .order_by(mi.c.sort_order, mi.c.name))
        drop_deleted = ids is None
        if ids is not None:
            if not ids:
                return []
            stmt = stmt.where(mi.c.id.in_(ids))
        rows = self._conn.execute(stmt).all()
        item_ids = [r.id for r in rows]
        if not item_ids:
            return []
        ingredients: dict[UUID, list[ItemIngredient]] = defaultdict(list)
        for r in self._conn.execute(
                select(mii.c.menu_item_id, mii.c.is_removable, ing.c.id, ing.c.name, ing.c.is_available,
                       ing.c.deleted_at)
                .join(ing, ing.c.id == mii.c.ingredient_id).where(mii.c.menu_item_id.in_(item_ids))
                .order_by(mii.c.sort_order, ing.c.name)):
            if r.deleted_at is not None and drop_deleted and r.is_removable:
                continue
            ingredient = Ingredient(r.id, r.name, r.is_available and r.deleted_at is None)
            ingredients[r.menu_item_id].append(ItemIngredient(ingredient, r.is_removable))
        extra_ing = ing.alias("extra_ingredient")
        extras: dict[UUID, list[ItemExtra]] = defaultdict(list)
        for r in self._conn.execute(
                select(mie.c.menu_item_id, mie.c.max_quantity, ex.c.id, ex.c.name, ex.c.price_cents, ex.c.cost_cents,
                       ex.c.is_available, ex.c.deleted_at, extra_ing.c.id.label("ing_id"), extra_ing.c.name.label("ing_name"),
                       extra_ing.c.is_available.label("ing_available"))
                .join(ex, ex.c.id == mie.c.extra_id).outerjoin(extra_ing, extra_ing.c.id == ex.c.ingredient_id)
                .where(mie.c.menu_item_id.in_(item_ids)).order_by(mie.c.sort_order, ex.c.name)):
            if r.deleted_at is not None and drop_deleted:
                continue
            linked = Ingredient(r.ing_id, r.ing_name, r.ing_available) if r.ing_id else None
            extra = Extra(r.id, r.name, r.price_cents, r.cost_cents, r.is_available and r.deleted_at is None, linked)
            extras[r.menu_item_id].append(ItemExtra(extra, r.max_quantity))
        return [MenuItem(r.id, r.category_id, r.name, r.price_cents, r.cost_cents, r.is_available,
                         r.is_active and r.category_visible,
                         r.deleted_at is not None, tuple(ingredients[r.id]), tuple(extras[r.id]), r.description,
                         r.photo_path, r.prep_minutes, tuple(r.tags or ())) for r in rows]

    def list_menu(self) -> list[MenuCategoryView]:
        c = t.categories
        cats = self._conn.execute(select(c.c.id, c.c.name).where(c.c.is_active, c.c.deleted_at.is_(None))
                                  .order_by(c.c.sort_order, c.c.name)).all()
        by_category: dict[UUID, list[MenuItem]] = defaultdict(list)
        for item in self._load(None):
            by_category[item.category_id].append(item)
        return [MenuCategoryView(r.id, r.name, by_category[r.id]) for r in cats]


class SqlOrderRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def _fetch(self, stmt) -> list[Order]:
        rows = self._conn.execute(stmt).all()
        lines = self._lines([r.id for r in rows])
        return [_row_to_order(r, lines[r.id]) for r in rows]

    def _lines(self, order_ids: list[UUID]) -> dict[UUID, list[PricedLine]]:
        result: dict[UUID, list[PricedLine]] = defaultdict(list)
        if not order_ids:
            return result
        oi, oie, oir = t.order_items, t.order_item_extras, t.order_item_removed_ingredients
        items = self._conn.execute(select(oi).where(oi.c.order_id.in_(order_ids))
                                   .order_by(oi.c.order_id, oi.c.position)).all()
        item_ids = [r.id for r in items]
        extras: dict[UUID, list[PricedExtra]] = defaultdict(list)
        removed: dict[UUID, list[RemovedIngredient]] = defaultdict(list)
        if item_ids:
            for r in self._conn.execute(select(oie).where(oie.c.order_item_id.in_(item_ids)).order_by(oie.c.position)):
                extras[r.order_item_id].append(
                    PricedExtra(r.extra_id, r.extra_name, r.unit_price_cents, r.unit_cost_cents, r.quantity))
            for r in self._conn.execute(select(oir).where(oir.c.order_item_id.in_(item_ids)).order_by(oir.c.position)):
                removed[r.order_item_id].append(RemovedIngredient(r.ingredient_id, r.ingredient_name))
        for r in items:
            result[r.order_id].append(PricedLine(
                r.menu_item_id, r.item_name, r.unit_price_cents, r.unit_cost_cents, r.quantity, r.note,
                tuple(extras[r.id]), tuple(removed[r.id]), r.line_total_cents, r.line_cost_cents))
        return result

    def _first(self, stmt) -> Order | None:
        found = self._fetch(stmt)
        return found[0] if found else None

    def get(self, order_id: UUID) -> Order | None:
        return self._first(select(t.orders).where(t.orders.c.id == order_id))

    def get_for_update(self, order_id: UUID) -> Order | None:
        return self._first(select(t.orders).where(t.orders.c.id == order_id).with_for_update())

    def get_by_idempotency_key(self, key: UUID) -> Order | None:
        return self._first(select(t.orders).where(t.orders.c.idempotency_key == key))

    def add(self, order: Order) -> None:
        self._conn.execute(insert(t.orders).values(
            id=order.id, session_id=order.session_id, table_id=order.table_id, daily_number=order.daily_number,
            round_number=order.round_number, status=order.status.value, idempotency_key=order.idempotency_key,
            subtotal_cents=order.subtotal_cents, cost_cents=order.cost_cents, created_at=order.created_at))
        items, extras, removed = [], [], []
        for position, line in enumerate(order.lines):
            item_id = uuid4()
            items.append({"id": item_id, "order_id": order.id, "position": position,
                          "menu_item_id": line.menu_item_id, "item_name": line.item_name,
                          "unit_price_cents": line.unit_price_cents, "unit_cost_cents": line.unit_cost_cents,
                          "quantity": line.quantity, "note": line.note, "line_total_cents": line.line_total_cents,
                          "line_cost_cents": line.line_cost_cents})
            extras += [{"id": uuid4(), "order_item_id": item_id, "position": i, "extra_id": e.extra_id,
                        "extra_name": e.name, "unit_price_cents": e.unit_price_cents,
                        "unit_cost_cents": e.unit_cost_cents, "quantity": e.quantity}
                       for i, e in enumerate(line.extras)]
            removed += [{"id": uuid4(), "order_item_id": item_id, "position": i, "ingredient_id": r.ingredient_id,
                         "ingredient_name": r.name} for i, r in enumerate(line.removed)]
        for table, rows in ((t.order_items, items), (t.order_item_extras, extras),
                            (t.order_item_removed_ingredients, removed)):
            if rows:
                self._conn.execute(insert(table), rows)

    def save(self, order: Order) -> None:
        self._conn.execute(update(t.orders).where(t.orders.c.id == order.id).values(
            status=order.status.value, subtotal_cents=order.subtotal_cents, cost_cents=order.cost_cents,
            preparing_at=order.preparing_at, ready_at=order.ready_at, served_at=order.served_at,
            cancelled_at=order.cancelled_at, cancelled_by=order.cancelled_by, cancel_reason=order.cancel_reason))

    def list_by_session(self, session_id: UUID) -> list[Order]:
        return self._fetch(select(t.orders).where(t.orders.c.session_id == session_id)
                           .order_by(t.orders.c.round_number))

    def list_by_status(self, statuses: Iterable[OrderStatus]) -> list[Order]:
        wanted = [s.value for s in statuses]
        return self._fetch(select(t.orders).where(t.orders.c.status.in_(wanted)).order_by(t.orders.c.created_at))

    def next_round_number(self, session_id: UUID) -> int:
        current = self._conn.execute(select(func.coalesce(func.max(t.orders.c.round_number), 0))
                                     .where(t.orders.c.session_id == session_id)).scalar_one()
        return current + 1

    def next_daily_number(self, day: date) -> int:
        stmt = pg_insert(t.daily_counters).values(day=day, last_number=1)
        stmt = stmt.on_conflict_do_update(index_elements=[t.daily_counters.c.day],
                                          set_={"last_number": t.daily_counters.c.last_number + 1})
        return self._conn.execute(stmt.returning(t.daily_counters.c.last_number)).scalar_one()


class SqlHistoryRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def add_table_change(self, change: StatusChange) -> None:
        self._conn.execute(insert(t.table_status_history).values(
            table_id=change.entity_id, session_id=change.session_id, from_status=change.from_status,
            to_status=change.to_status, source=change.source.value, changed_by=change.changed_by,
            changed_at=change.changed_at))

    def add_order_change(self, change: StatusChange) -> None:
        self._conn.execute(insert(t.order_status_history).values(
            order_id=change.entity_id, from_status=change.from_status, to_status=change.to_status,
            source=change.source.value, changed_by=change.changed_by, changed_at=change.changed_at))


class SqlStaffRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def get(self, staff_id: UUID) -> StaffMember | None:
        row = self._conn.execute(select(t.staff).where(t.staff.c.id == staff_id)).first()
        return StaffMember(row.id, row.full_name, StaffRole(row.role), row.is_active) if row else None


class SqlSettingsRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def auto_release_minutes(self) -> int:
        value = self._conn.execute(select(t.restaurant_settings.c.auto_release_minutes).limit(1)).scalar()
        return 5 if value is None else value


def _row_to_call(row: Row) -> ServiceCall:
    return ServiceCall(row.id, row.session_id, row.table_id, ServiceCallType(row.type), row.created_at,
                       row.attended_at, row.attended_by)


class SqlServiceCallRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def add(self, call: ServiceCall) -> None:
        self._conn.execute(insert(t.service_calls).values(
            id=call.id, session_id=call.session_id, table_id=call.table_id, type=call.type.value,
            created_at=call.created_at, attended_at=call.attended_at, attended_by=call.attended_by))

    def get_for_update(self, call_id: UUID) -> ServiceCall | None:
        row = self._conn.execute(select(t.service_calls).where(t.service_calls.c.id == call_id)
                                 .with_for_update()).first()
        return _row_to_call(row) if row else None

    def save(self, call: ServiceCall) -> None:
        self._conn.execute(update(t.service_calls).where(t.service_calls.c.id == call.id).values(
            attended_at=call.attended_at, attended_by=call.attended_by))

    def pending_for_session(self, session_id: UUID, call_type: ServiceCallType) -> ServiceCall | None:
        sc = t.service_calls
        row = self._conn.execute(select(sc).where(sc.c.session_id == session_id, sc.c.type == call_type.value,
                                                  sc.c.attended_at.is_(None)).limit(1)).first()
        return _row_to_call(row) if row else None

    def list_pending(self) -> list[ServiceCall]:
        sc = t.service_calls
        stmt = select(sc).where(sc.c.attended_at.is_(None)).order_by(sc.c.created_at)
        return [_row_to_call(r) for r in self._conn.execute(stmt)]


class SqlPaymentRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def add(self, payment: Payment) -> None:
        self._conn.execute(insert(t.payments).values(
            id=payment.id, session_id=payment.session_id, method=payment.method.value, status=payment.status.value,
            amount_cents=payment.amount_cents, tip_cents=payment.tip_cents, received_by=payment.received_by,
            paid_at=payment.paid_at, created_at=payment.created_at, created_by=payment.received_by))

    def list_by_session(self, session_id: UUID) -> list[Payment]:
        p = t.payments
        rows = self._conn.execute(select(p).where(p.c.session_id == session_id).order_by(p.c.created_at))
        return [Payment(r.id, r.session_id, PaymentMethod(r.method), PaymentStatus(r.status), r.amount_cents,
                        r.tip_cents, r.received_by, r.paid_at, r.created_at) for r in rows]


_AVAILABILITY_TABLES = {
    AvailabilityEntity.MENU_ITEM: t.menu_items,
    AvailabilityEntity.INGREDIENT: t.ingredients,
    AvailabilityEntity.EXTRA: t.extras,
}


class SqlAvailabilityRepository:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def set_available(self, entity: AvailabilityEntity, entity_id: UUID, is_available: bool,
                      staff_id: UUID) -> bool:
        table = _AVAILABILITY_TABLES[entity]
        result = self._conn.execute(update(table).where(table.c.id == entity_id, table.c.deleted_at.is_(None))
                                    .values(is_available=is_available, updated_by=staff_id))
        return result.rowcount == 1

    def add_log(self, entity: AvailabilityEntity, entity_id: UUID, is_available: bool, staff_id: UUID,
                at) -> None:
        self._conn.execute(insert(t.availability_log).values(
            entity_type=entity.value, entity_id=entity_id, is_available=is_available, changed_by=staff_id,
            changed_at=at, created_by=staff_id))

    def list_board(self) -> AvailabilityBoardView:
        mi, ing, ex, mii, mie = t.menu_items, t.ingredients, t.extras, t.menu_item_ingredients, t.menu_item_extras
        live_item = mi.c.deleted_at.is_(None)
        items = [AvailabilityRow(r.id, r.name, r.is_available) for r in self._conn.execute(
            select(mi.c.id, mi.c.name, mi.c.is_available).where(live_item).order_by(mi.c.name))]

        def rows(table, link, link_col):
            used = (select(func.count()).select_from(link).join(mi, mi.c.id == link.c.menu_item_id)
                    .where(link_col == table.c.id, live_item).scalar_subquery())
            stmt = (select(table.c.id, table.c.name, table.c.is_available, used.label("used_in"))
                    .where(table.c.deleted_at.is_(None)).order_by(table.c.name))
            return [AvailabilityRow(r.id, r.name, r.is_available, r.used_in) for r in self._conn.execute(stmt)]

        return AvailabilityBoardView(items, rows(ing, mii, mii.c.ingredient_id), rows(ex, mie, mie.c.extra_id))
