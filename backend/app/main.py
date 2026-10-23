from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.infrastructure.auth.jwt_verifier import JwtVerifier
from app.infrastructure.config import Settings
from app.infrastructure.db.engine import make_engine
from app.infrastructure.scheduler import start_scheduler
from app.presentation.errors import register_error_handlers
from app.presentation.rate_limit import OrderRateLimiter
from app.presentation.routers import admin, availability, diner, kitchen, staff, waiter


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    scheduler = start_scheduler(app.state) if app.state.settings.enable_scheduler else None
    try:
        yield
    finally:
        if scheduler:
            scheduler.shutdown(wait=False)
        app.state.engine.dispose()


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="Foody API", lifespan=lifespan)
    app.state.settings = settings
    app.state.engine = make_engine(settings.database_url)
    app.state.verifier = JwtVerifier(settings.supabase_url, settings.supabase_jwt_secret)
    app.state.order_limiter = OrderRateLimiter()
    register_error_handlers(app)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    api = APIRouter(prefix="/api/v1")

    @api.get("/health")
    def health() -> dict[str, str]:
        return {"status": "ok"}

    for router in (staff.router, diner.router, kitchen.router, waiter.router, availability.router, admin.router):
        api.include_router(router)
    app.include_router(api)
    return app
