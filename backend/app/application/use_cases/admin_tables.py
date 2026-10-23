import secrets
from uuid import UUID

from app.application.ports import UnitOfWork
from app.application.use_cases.admin_catalog import create_entry
from app.domain.enums import TableStatus
from app.domain.errors import InvalidTransition, NotFound


def new_qr_token() -> str:
    return secrets.token_urlsafe(24)


def create_table(uow: UnitOfWork, values: dict, staff_id: UUID) -> dict:
    return create_entry(uow, "dining_tables", {**values, "qr_token": new_qr_token()}, staff_id)


def delete_table(uow: UnitOfWork, table_id: UUID, staff_id: UUID) -> None:
    with uow:
        table = uow.tables.get_for_update(table_id)
        if table is None:
            raise NotFound(details={"table_id": str(table_id)})
        if table.status != TableStatus.FREE:
            raise InvalidTransition("Solo se puede borrar una mesa libre", {"status": table.status.value})
        uow.catalog.soft_delete("dining_tables", table_id, staff_id)
        uow.commit()


def regenerate_qr(uow: UnitOfWork, table_id: UUID, staff_id: UUID) -> str:
    token = new_qr_token()
    with uow:
        if not uow.catalog.update("dining_tables", table_id, {"qr_token": token}, staff_id):
            raise NotFound(details={"table_id": str(table_id)})
        uow.commit()
    return token


def table_qr_url(uow: UnitOfWork, table_id: UUID, public_app_url: str) -> str:
    with uow:
        table = uow.tables.get(table_id)
    if table is None:
        raise NotFound(details={"table_id": str(table_id)})
    return f"{public_app_url.rstrip('/')}/mesa/{table.qr_token}"
