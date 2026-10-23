import httpx

BUCKET = "menu-photos"


class SupabasePhotoStorage:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._base = f"{supabase_url.rstrip('/')}/storage/v1/object/{BUCKET}"
        self._key = service_role_key

    def upload(self, path: str, content: bytes, content_type: str) -> None:
        response = httpx.post(f"{self._base}/{path}", content=content, timeout=30,
                              headers={"Authorization": f"Bearer {self._key}", "apikey": self._key,
                                       "Content-Type": content_type, "x-upsert": "true"})
        response.raise_for_status()
