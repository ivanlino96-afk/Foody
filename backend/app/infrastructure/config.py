from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str
    supabase_url: str
    supabase_jwt_secret: str | None = None
    timezone: str = "America/Mexico_City"
    cors_origins: list[str] = ["http://localhost:5173"]
    enable_scheduler: bool = True
