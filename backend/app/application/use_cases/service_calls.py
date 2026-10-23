from uuid import UUID, uuid4

from app.application.dto import ServiceCallView
from app.application.ports import Clock, UnitOfWork
from app.application.use_cases.tables import apply_table_event
from app.domain.entities import ServiceCall
from app.domain.enums import ChangeSource, ServiceCallType, TableEvent, TableStatus
from app.domain.errors import InvalidTransition, NotFound, TableNotOpen

_OPEN = frozenset({TableStatus.OCCUPIED, TableStatus.AWAITING_ORDER, TableStatus.SERVED, TableStatus.BILL_REQUESTED})


def request_service_call(uow: UnitOfWork, clock: Clock, qr_token: str, call_type: ServiceCallType) -> ServiceCall:
    with uow:
        found = uow.tables.get_by_qr(qr_token)
        if found is None:
            raise NotFound(details={"qr_token": qr_token})
        table = uow.tables.get_for_update(found.id)
        if table.status not in _OPEN or table.current_session_id is None:
            raise TableNotOpen(details={"status": table.status.value})
        session = uow.sessions.get_for_update(table.current_session_id)
        existing = uow.service_calls.pending_for_session(session.id, call_type)
        if existing is not None:
            return existing
        now = clock.now()
        call = ServiceCall(uuid4(), session.id, table.id, call_type, now)
        uow.service_calls.add(call)
        if call_type == ServiceCallType.REQUEST_BILL and table.status != TableStatus.BILL_REQUESTED:
            apply_table_event(uow, clock, table, TableEvent.BILL_REQUESTED, ChangeSource.DINER, None)
            session.bill_requested_at = now
            uow.sessions.save(session)
        uow.commit()
        return call


def attend_service_call(uow: UnitOfWork, clock: Clock, call_id: UUID, staff_id: UUID) -> ServiceCall:
    with uow:
        call = uow.service_calls.get_for_update(call_id)
        if call is None:
            raise NotFound(details={"service_call_id": str(call_id)})
        if call.attended_at is not None:
            raise InvalidTransition("Este aviso ya fue atendido")
        call.attended_at, call.attended_by = clock.now(), staff_id
        uow.service_calls.save(call)
        uow.commit()
        return call


def list_pending_calls(uow: UnitOfWork) -> list[ServiceCallView]:
    with uow:
        codes = {t.id: t.code for t in uow.tables.list_active()}
        return [ServiceCallView(c.id, codes.get(c.table_id, "?"), c.type, c.created_at)
                for c in uow.service_calls.list_pending()]
