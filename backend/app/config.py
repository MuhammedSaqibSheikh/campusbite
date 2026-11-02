from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./campusbite.db"
    jwt_secret: str
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24
    cors_origins: str = "http://localhost:5173"

    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"
    # Optional OpenAI-compatible endpoint, e.g. GitHub Models: https://models.github.ai/inference
    openai_base_url: str = ""
    ai_rate_limit_per_minute: int = 10

    reminder_threshold_minutes: int = 15
    reminder_interval_seconds: int = 60

    seed_demo_data: bool = True
    allow_staff_registration: bool = True

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
