from fastapi import APIRouter, Depends

from app.presentation.deps import CurrentStaff, current_staff

router = APIRouter(tags=["staff"])


@router.get("/me")
def me(staff: CurrentStaff = Depends(current_staff)) -> dict:
    return {"id": str(staff.id), "full_name": staff.full_name, "role": staff.role.value}
