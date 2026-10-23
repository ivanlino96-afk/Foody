from uuid import uuid4

import pytest

from app.presentation.deps import get_photo_storage
from tests.api.conftest import auth


class FakeStorage:
    def __init__(self):
        self.uploads = []

    def upload(self, path, content, content_type):
        self.uploads.append((path, content, content_type))


class FakeCatalog:
    def __init__(self):
        self.updates = []

    def update(self, kind, entity_id, values, staff_id):
        self.updates.append((kind, entity_id, values))
        return True


@pytest.fixture
def storage(app, uow):
    fake = FakeStorage()
    uow.catalog = FakeCatalog()
    app.dependency_overrides[get_photo_storage] = lambda: fake
    return fake


def test_photo_upload_stores_path(client, admin, uow, storage):
    item_id = uuid4()
    r = client.post(f"/api/v1/admin/menu-items/{item_id}/photo", headers=auth(admin),
                    files={"file": ("bowl.png", b"\x89PNG fake", "image/png")})
    assert r.status_code == 200, r.text
    path = r.json()["photo_path"]
    assert path.startswith(f"items/{item_id}/") and path.endswith(".png")
    assert storage.uploads == [(path, b"\x89PNG fake", "image/png")]
    assert uow.catalog.updates == [("menu_items", item_id, {"photo_path": path})]


@pytest.mark.parametrize(("name", "content", "ctype"), [("a.gif", b"GIF89a", "image/gif"),
                                                         ("big.jpg", b"x" * (5 * 1024 * 1024 + 1), "image/jpeg")])
def test_photo_upload_rejects_wrong_type_and_size(client, admin, storage, name, content, ctype):
    r = client.post(f"/api/v1/admin/menu-items/{uuid4()}/photo", headers=auth(admin),
                    files={"file": (name, content, ctype)})
    assert r.status_code == 422 and r.json()["code"] == "invalid_customization"
    assert storage.uploads == []

