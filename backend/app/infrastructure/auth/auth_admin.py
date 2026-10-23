from uuid import UUID

import httpx

from app.domain.errors import DuplicateEmail


class SupabaseAuthAdmin:
    def __init__(self, supabase_url: str, service_role_key: str) -> None:
        self._url = f"{supabase_url.rstrip('/')}/auth/v1/admin/users"
        self._key = service_role_key

    def create_user(self, email: str, password: str) -> UUID:
        response = httpx.post(self._url, timeout=15, json={"email": email, "password": password, "email_confirm": True},
                              headers={"Authorization": f"Bearer {self._key}", "apikey": self._key})
        if response.status_code == 422 and "already" in response.text.lower():
            raise DuplicateEmail(details={"email": email})
        response.raise_for_status()
        return UUID(response.json()["id"])
