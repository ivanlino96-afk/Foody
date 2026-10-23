from uuid import UUID

from fastapi import APIRouter, Depends, Response, status

from app.application.dto import AvailabilityBoardView
from app.application.ports import Clock, UnitOfWork
from app.application.use_cases.availability import get_availability_board, set_availability
from app.domain.enums import AvailabilityEntity, StaffRole
from app.presentation.deps import CurrentStaff, get_clock, get_uow, require_roles
from app.presentation.schemas import AvailabilityIn

router = APIRouter(prefix="/availability", tags=["availability"])
kitchen_or_admin = require_roles(StaffRole.KITCHEN)


@router.get("", dependencies=[Depends(kitchen_or_admin)])
def board(uow: UnitOfWork = Depends(get_uow)) -> AvailabilityBoardView:
    return get_availability_board(uow)


@router.patch("/{entity}/{entity_id}", status_code=status.HTTP_204_NO_CONTENT)
def toggle(entity: AvailabilityEntity, entity_id: UUID, body: AvailabilityIn,
           staff: CurrentStaff = Depends(kitchen_or_admin), uow: UnitOfWork = Depends(get_uow),
           clock: Clock = Depends(get_clock)) -> Response:
    set_availability(uow, clock, entity, entity_id, body.is_available, staff.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
