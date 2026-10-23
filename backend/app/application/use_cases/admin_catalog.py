from uuid import UUID, uuid4

from app.application.ports import CatalogKind, PhotoStorage, UnitOfWork
from app.domain.errors import InvalidCustomization, NotFound

PHOTO_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}
MAX_PHOTO_BYTES = 5 * 1024 * 1024
_LINKS = ("ingredients", "extras")


def list_entries(uow: UnitOfWork, kind: CatalogKind) -> list[dict]:
    with uow:
        return uow.catalog.list_all(kind)


def _get_or_404(uow: UnitOfWork, kind: CatalogKind, entity_id: UUID) -> dict:
    row = uow.catalog.get(kind, entity_id)
    if row is None:
        raise NotFound(details={"kind": kind, "id": str(entity_id)})
    return row


def create_entry(uow: UnitOfWork, kind: CatalogKind, values: dict, staff_id: UUID) -> dict:
    links = {k: values.pop(k) for k in _LINKS if k in values}
    with uow:
        new_id = uow.catalog.create(kind, values, staff_id)
        if links:
            uow.catalog.set_item_links(new_id, links.get("ingredients"), links.get("extras"), staff_id)
        row = _get_or_404(uow, kind, new_id)
        uow.commit()
        return row


def update_entry(uow: UnitOfWork, kind: CatalogKind, entity_id: UUID, values: dict, staff_id: UUID) -> dict:
    links = {k: values.pop(k) for k in _LINKS if k in values}
    with uow:
        if values and not uow.catalog.update(kind, entity_id, values, staff_id):
            raise NotFound(details={"kind": kind, "id": str(entity_id)})
        _get_or_404(uow, kind, entity_id)
        if links:
            uow.catalog.set_item_links(entity_id, links.get("ingredients"), links.get("extras"), staff_id)
        row = _get_or_404(uow, kind, entity_id)
        uow.commit()
        return row


def delete_entry(uow: UnitOfWork, kind: CatalogKind, entity_id: UUID, staff_id: UUID) -> None:
    with uow:
        if not uow.catalog.soft_delete(kind, entity_id, staff_id):
            raise NotFound(details={"kind": kind, "id": str(entity_id)})
        uow.commit()


def upload_menu_photo(uow: UnitOfWork, storage: PhotoStorage, item_id: UUID, content: bytes, content_type: str,
                      staff_id: UUID) -> str:
    extension = PHOTO_TYPES.get(content_type)
    if extension is None:
        raise InvalidCustomization("La foto debe ser JPG, PNG o WebP", {"field": "file"})
    if len(content) > MAX_PHOTO_BYTES:
        raise InvalidCustomization("La foto pesa más de 5 MB", {"field": "file"})
    path = f"items/{item_id}/{uuid4().hex}.{extension}"
    with uow:
        if not uow.catalog.update("menu_items", item_id, {"photo_path": path}, staff_id):
            raise NotFound(details={"menu_item_id": str(item_id)})
        storage.upload(path, content, content_type)
        uow.commit()
    return path
