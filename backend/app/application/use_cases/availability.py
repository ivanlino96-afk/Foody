from uuid import UUID

from app.application.dto import AvailabilityBoardView
from app.application.ports import Clock, UnitOfWork
from app.domain.enums import AvailabilityEntity
from app.domain.errors import NotFound


def set_availability(uow: UnitOfWork, clock: Clock, entity: AvailabilityEntity, entity_id: UUID, is_available: bool,
                     staff_id: UUID) -> None:
    with uow:
        if not uow.availability.set_available(entity, entity_id, is_available, staff_id):
            raise NotFound(details={"entity": entity.value, "id": str(entity_id)})
        uow.availability.add_log(entity, entity_id, is_available, staff_id, clock.now())
        uow.commit()


def get_availability_board(uow: UnitOfWork) -> AvailabilityBoardView:
    with uow:
        return uow.availability.list_board()
