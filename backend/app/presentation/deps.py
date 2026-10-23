from collections.abc import Callable, Iterator
from dataclasses import dataclass
from uuid import UUID

from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.application.ports import Clock, UnitOfWork
from app.domain.enums import StaffRole
from app.domain.errors import Forbidden
from app.infrastructure.auth.jwt_verifier import JwtVerifier
from app.infrastructure.clock import SystemClock
from app.infrastructure.db.unit_of_work import SqlUnitOfWork
from app.presentation.errors import Unauthorized

_bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentStaff:
    id: UUID
    role: StaffRole
    full_name: str


def get_uow(request: Request) -> Iterator[UnitOfWork]:
    yield SqlUnitOfWork(request.app.state.engine)


def get_clock(request: Request) -> Clock:
    return SystemClock(request.app.state.settings.timezone)


def get_verifier(request: Request) -> JwtVerifier:
    return request.app.state.verifier


def current_staff(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
    verifier: JwtVerifier = Depends(get_verifier),
    uow: UnitOfWork = Depends(get_uow),
) -> CurrentStaff:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise Unauthorized()
    staff_id = verifier.verify(credentials.credentials)
    with uow:
        member = uow.staff.get(staff_id)
    if member is None or not member.is_active:
        raise Forbidden("Tu usuario no tiene acceso")
    return CurrentStaff(member.id, member.role, member.full_name)


def require_roles(*roles: StaffRole) -> Callable[..., CurrentStaff]:
    allowed = {StaffRole.ADMIN, *roles}

    def guard(staff: CurrentStaff = Depends(current_staff)) -> CurrentStaff:
        if staff.role not in allowed:
            raise Forbidden("Tu rol no puede hacer esto")
        return staff

    return guard
