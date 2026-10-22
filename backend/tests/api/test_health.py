from fastapi.testclient import TestClient

from app.infrastructure.config import Settings
from app.main import create_app


def test_health_returns_ok():
    client = TestClient(create_app(Settings(database_url="sqlite://", supabase_url="http://x", enable_scheduler=False)))
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}
