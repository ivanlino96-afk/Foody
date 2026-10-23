import io
from uuid import UUID

import segno
from fastapi import APIRouter, Depends, File, Request, Response, UploadFile, status
from pydantic import BaseModel

from app.application.ports import PhotoStorage, UnitOfWork
from app.application.use_cases.admin_catalog import (
    MAX_PHOTO_BYTES,
    create_entry,
    delete_entry,
    list_entries,
    update_entry,
    upload_menu_photo,
)
from app.application.use_cases.admin_tables import create_table, delete_table, regenerate_qr, table_qr_url
from app.presentation.admin_schemas import (
    CategoryIn,
    CategoryPatch,
    ExtraIn,
    ExtraPatch,
    IngredientIn,
    IngredientPatch,
    MenuItemIn,
    MenuItemPatch,
    TableIn,
    TablePatch,
)
from app.presentation.deps import CurrentStaff, get_photo_storage, get_uow, require_roles

admin_only = require_roles()
router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(admin_only)])


def _crud(path: str, kind: str, create_model: type[BaseModel], patch_model: type[BaseModel]) -> None:
    """Registers list/create/update/delete for one catalog kind."""

    @router.get(f"/{path}", name=f"list_{kind}")
    def list_(uow: UnitOfWork = Depends(get_uow)) -> list[dict]:
        return list_entries(uow, kind)

    @router.post(f"/{path}", status_code=status.HTTP_201_CREATED, name=f"create_{kind}")
    def create(body: create_model, staff: CurrentStaff = Depends(admin_only),  # type: ignore[valid-type]
               uow: UnitOfWork = Depends(get_uow)) -> dict:
        return create_entry(uow, kind, body.model_dump(mode="python"), staff.id)

    @router.patch(f"/{path}/{{entity_id}}", name=f"update_{kind}")
    def patch(entity_id: UUID, body: patch_model, staff: CurrentStaff = Depends(admin_only),  # type: ignore[valid-type]
              uow: UnitOfWork = Depends(get_uow)) -> dict:
        return update_entry(uow, kind, entity_id, body.model_dump(mode="python", exclude_unset=True), staff.id)

    if kind != "dining_tables":
        @router.delete(f"/{path}/{{entity_id}}", status_code=status.HTTP_204_NO_CONTENT, name=f"delete_{kind}")
        def remove(entity_id: UUID, staff: CurrentStaff = Depends(admin_only),
                   uow: UnitOfWork = Depends(get_uow)) -> Response:
            delete_entry(uow, kind, entity_id, staff.id)
            return Response(status_code=status.HTTP_204_NO_CONTENT)


_crud("categories", "categories", CategoryIn, CategoryPatch)
_crud("ingredients", "ingredients", IngredientIn, IngredientPatch)
_crud("extras", "extras", ExtraIn, ExtraPatch)
_crud("menu-items", "menu_items", MenuItemIn, MenuItemPatch)


@router.post("/menu-items/{item_id}/photo")
def photo(item_id: UUID, file: UploadFile = File(...), staff: CurrentStaff = Depends(admin_only),
          uow: UnitOfWork = Depends(get_uow), storage: PhotoStorage = Depends(get_photo_storage)) -> dict:
    content = file.file.read(MAX_PHOTO_BYTES + 1)
    return {"photo_path": upload_menu_photo(uow, storage, item_id, content, file.content_type or "", staff.id)}


@router.get("/tables")
def list_tables(uow: UnitOfWork = Depends(get_uow)) -> list[dict]:
    return list_entries(uow, "dining_tables")


@router.post("/tables", status_code=status.HTTP_201_CREATED)
def add_table(body: TableIn, staff: CurrentStaff = Depends(admin_only), uow: UnitOfWork = Depends(get_uow)) -> dict:
    return create_table(uow, body.model_dump(), staff.id)


@router.patch("/tables/{table_id}")
def edit_table(table_id: UUID, body: TablePatch, staff: CurrentStaff = Depends(admin_only),
               uow: UnitOfWork = Depends(get_uow)) -> dict:
    return update_entry(uow, "dining_tables", table_id, body.model_dump(exclude_unset=True), staff.id)


@router.delete("/tables/{table_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_table(table_id: UUID, staff: CurrentStaff = Depends(admin_only),
                 uow: UnitOfWork = Depends(get_uow)) -> Response:
    delete_table(uow, table_id, staff.id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/tables/{table_id}/regenerate-qr")
def new_qr(table_id: UUID, staff: CurrentStaff = Depends(admin_only), uow: UnitOfWork = Depends(get_uow)) -> dict:
    return {"qr_token": regenerate_qr(uow, table_id, staff.id)}


@router.get("/tables/{table_id}/qr.png")
def qr_png(table_id: UUID, request: Request, uow: UnitOfWork = Depends(get_uow)) -> Response:
    url = table_qr_url(uow, table_id, request.app.state.settings.public_app_url)
    buffer = io.BytesIO()
    segno.make(url, error="m").save(buffer, kind="png", scale=10, border=2)
    return Response(buffer.getvalue(), media_type="image/png")
