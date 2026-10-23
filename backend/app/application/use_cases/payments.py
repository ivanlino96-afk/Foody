from uuid import UUID, uuid4

from app.application.ports import Clock, UnitOfWork
from app.application.use_cases.tables import apply_table_event
from app.domain.entities import Payment
from app.domain.enums import ChangeSource, PaymentMethod, PaymentStatus, ServiceCallType, TableEvent
from app.domain.errors import InvalidCustomization, InvalidTransition, NotFound
from app.domain.services.billing import apply_payment
from app.domain.services.table_state_machine import can_order

MANUAL_METHODS = frozenset({PaymentMethod.CASH, PaymentMethod.CARD_TERMINAL})


def register_manual_payment(uow: UnitOfWork, clock: Clock, session_id: UUID, method: PaymentMethod,
                            amount_cents: int, tip_cents: int, staff_id: UUID) -> Payment:
    if method not in MANUAL_METHODS:
        raise InvalidCustomization("El mesero solo registra efectivo o terminal", {"field": "method"})
    with uow:
        peek = uow.sessions.get(session_id)
        if peek is None:
            raise NotFound(details={"session_id": str(session_id)})
        table = uow.tables.get_for_update(peek.table_id)  # lock order: table → session
        session = uow.sessions.get_for_update(session_id)
        if session.closed_at is not None or session.paid_at is not None or table.current_session_id != session.id:
            raise InvalidTransition("Esta cuenta ya está cerrada", {"session_id": str(session_id)})
        settled = apply_payment(session, amount_cents, tip_cents)
        if can_order(table.status):
            apply_table_event(uow, clock, table, TableEvent.BILL_REQUESTED, ChangeSource.STAFF, staff_id)
        now = clock.now()
        if session.bill_requested_at is None:
            session.bill_requested_at = now
        payment = Payment(uuid4(), session.id, method, PaymentStatus.APPROVED, amount_cents, tip_cents, staff_id, now,
                          now)
        uow.payments.add(payment)
        if settled:
            session.paid_at = now
            apply_table_event(uow, clock, table, TableEvent.PAID, ChangeSource.PAYMENT, staff_id)
            call = uow.service_calls.pending_for_session(session.id, ServiceCallType.REQUEST_BILL)
            if call is not None:
                call.attended_at, call.attended_by = now, staff_id
                uow.service_calls.save(call)
        uow.sessions.save(session)
        uow.commit()
        return payment
