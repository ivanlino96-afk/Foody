from fastapi import APIRouter, FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.infrastructure.config import Settings


def create_app(settings: Settings | None = None) -> FastAPI:
    settings = settings or Settings()
    app = FastAPI(title="Foody API")
    app.state.settings = settings
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

    app.include_router(api)
    return app
