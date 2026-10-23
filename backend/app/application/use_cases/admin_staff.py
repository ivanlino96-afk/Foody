from uuid import UUID

from app.application.dto import StaffMember
from app.application.ports import AuthAdmin, UnitOfWork
from app.domain.enums import StaffRole
from app.domain.errors import InvalidTransition, NotFound


def list_staff(uow: UnitOfWork) -> list[dict]:
    with uow:
        return uow.staff.list_all()


def create_staff(uow: UnitOfWork, auth: AuthAdmin, email: str, password: str, full_name: str, role: StaffRole,
                 admin_id: UUID) -> StaffMember:
    # The auth user must exist first: staff.id references auth.users.
    member = StaffMember(auth.create_user(email, password), full_name, role, True)
    with uow:
        uow.staff.add(member, admin_id)
        uow.commit()
    return member


def update_staff(uow: UnitOfWork, staff_id: UUID, admin_id: UUID, full_name: str | None = None,
                 role: StaffRole | None = None, is_active: bool | None = None) -> StaffMember:
    with uow:
        member = uow.staff.get(staff_id)
        if member is None:
            raise NotFound(details={"staff_id": str(staff_id)})
        if staff_id == admin_id and (is_active is False or (role is not None and role != StaffRole.ADMIN)):
            raise InvalidTransition("No puedes desactivarte ni quitarte el rol de admin")
        values = {k: v for k, v in {"full_name": full_name, "role": role, "is_active": is_active}.items()
                  if v is not None}
        if values:
            uow.staff.update(staff_id, values, admin_id)
        updated = uow.staff.get(staff_id)
        uow.commit()
        return updated
