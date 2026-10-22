from fastapi import Request
from limits import parse
from limits.storage import MemoryStorage
from limits.strategies import MovingWindowRateLimiter

from app.presentation.errors import RateLimited


class OrderRateLimiter:
    """10 orders per minute for each table QR and client IP; in-process memory, one per app."""

    def __init__(self, rate: str = "10/minute") -> None:
        self._limit = parse(rate)
        self._limiter = MovingWindowRateLimiter(MemoryStorage())

    def check(self, qr_token: str, client_ip: str) -> None:
        if not self._limiter.hit(self._limit, "orders", f"{qr_token}:{client_ip}"):
            raise RateLimited()


def limit_orders(request: Request, qr_token: str) -> None:
    client_ip = request.client.host if request.client else "unknown"
    request.app.state.order_limiter.check(qr_token, client_ip)
