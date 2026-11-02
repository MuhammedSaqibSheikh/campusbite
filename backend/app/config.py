from functools import lru_cache
from typing import Union

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy.engine import URL


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    database_url: str = "sqlite:///./campusbite.db"
    # When POSTGRES_HOST is set (Docker Compose), the URL is built from these parts so that
    # special characters in the password (e.g. "@", ":", "/") are escaped correctly.
    postgres_host: str = ""
    postgres_port: int = 5432
    postgres_user: str = ""
    postgres_password: str = ""
    postgres_db: str = ""
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
    def sqlalchemy_url(self) -> Union[str, URL]:
        if self.postgres_host:
            return URL.create(
                "postgresql+psycopg2",
                username=self.postgres_user,
                password=self.postgres_password,
                host=self.postgres_host,
                port=self.postgres_port,
                database=self.postgres_db,
            )
        return self.database_url

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
