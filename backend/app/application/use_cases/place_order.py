from dataclasses import dataclass
from uuid import UUID, uuid4

from app.application.ports import Clock, UnitOfWork
from app.application.use_cases.tables import apply_table_event
from app.domain.entities import Order, StatusChange
from app.domain.enums import ChangeSource, OrderStatus, TableEvent
from app.domain.errors import NotFound, PriceChanged, TableNotOpen
from app.domain.services.pricing import LineRequest, price_order
from app.domain.services.table_state_machine import can_order


@dataclass(frozen=True)
class PlaceOrderCommand:
    qr_token: str
    idempotency_key: UUID
    lines: tuple[LineRequest, ...]
    expected_total_cents: int | None


def place_order(uow: UnitOfWork, clock: Clock, cmd: PlaceOrderCommand) -> Order:
    with uow:
        existing = uow.orders.get_by_idempotency_key(cmd.idempotency_key)
        if existing is not None:
            return existing

        found = uow.tables.get_by_qr(cmd.qr_token)
        if found is None:
            raise NotFound(details={"qr_token": cmd.qr_token})
        table = uow.tables.get_for_update(found.id)
        if not can_order(table.status) or table.current_session_id is None:
            raise TableNotOpen(details={"status": table.status.value})
        session = uow.sessions.get_for_update(table.current_session_id)

        priced = price_order(uow.menu.get_items({line.menu_item_id for line in cmd.lines}), cmd.lines)
        if cmd.expected_total_cents is not None and cmd.expected_total_cents != priced.subtotal_cents:
            raise PriceChanged(priced.subtotal_cents)

        now = clock.now()
        order = Order(
            id=uuid4(),
            session_id=session.id,
            table_id=table.id,
            daily_number=uow.orders.next_daily_number(clock.business_date()),
            round_number=uow.orders.next_round_number(session.id),
            status=OrderStatus.RECEIVED,
            idempotency_key=cmd.idempotency_key,
            subtotal_cents=priced.subtotal_cents,
            cost_cents=priced.cost_cents,
            lines=list(priced.lines),
            created_at=now,
        )
        uow.orders.add(order)
        uow.history.add_order_change(
            StatusChange(order.id, session.id, None, OrderStatus.RECEIVED.value, ChangeSource.DINER, None, now))

        session.subtotal_cents += priced.subtotal_cents
        session.cost_cents += priced.cost_cents
        uow.sessions.save(session)

        apply_table_event(uow, clock, table, TableEvent.ORDER_PLACED, ChangeSource.DINER, None)
        uow.commit()
        return order
