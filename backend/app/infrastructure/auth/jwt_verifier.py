from functools import cached_property
from uuid import UUID

import jwt

from app.domain.errors import Forbidden

ASYMMETRIC_ALGORITHMS = ["RS256", "ES256", "EdDSA"]


class JwtVerifier:
    """Verifies Supabase access tokens: JWKS for asymmetric keys, the shared secret for HS256."""

    def __init__(self, supabase_url: str, jwt_secret: str | None) -> None:
        self._jwks_url = f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
        self._secret = jwt_secret

    @cached_property
    def _jwks(self) -> jwt.PyJWKClient:
        return jwt.PyJWKClient(self._jwks_url, cache_keys=True)

    def verify(self, token: str) -> UUID:
        try:
            algorithm = jwt.get_unverified_header(token).get("alg")
            if algorithm == "HS256":
                if not self._secret:
                    raise Forbidden("Token no válido")
                claims = jwt.decode(token, self._secret, algorithms=["HS256"], audience="authenticated")
            else:
                key = self._jwks.get_signing_key_from_jwt(token).key
                claims = jwt.decode(token, key, algorithms=ASYMMETRIC_ALGORITHMS, audience="authenticated")
            return UUID(claims["sub"])
        except (jwt.PyJWTError, KeyError, ValueError) as exc:
            raise Forbidden("Token no válido o vencido") from exc
