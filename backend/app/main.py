from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.infrastructure.auth.jwt_verifier import JwtVerifier
from app.infrastructure.config import Settings
from app.infrastructure.db.engine import make_engine
from app.presentation.errors import register_error_handlers
from app.presentation.rate_limit import OrderRateLimiter
from app.presentation.routers import diner


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="Foody API")
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

    api.include_router(diner.router)
    app.include_router(api)
    return app
