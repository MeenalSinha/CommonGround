"""Central, environment-driven configuration.

The Qloo key is optional at startup: an absent or blank key is represented as ``None`` so it can
never silently become an empty authentication header.
"""

from __future__ import annotations

from functools import lru_cache
from typing import Annotated, Any

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, NoDecode, SettingsConfigDict

DEFAULT_QLOO_BASE_URL = "https://hackathon.api.qloo.com"
APP_VERSION = "0.1.0"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    qloo_api_key: SecretStr | None = None
    qloo_base_url: str = DEFAULT_QLOO_BASE_URL
    qloo_timeout_seconds: float = Field(default=10.0, gt=0, le=60)
    qloo_max_retries: int = Field(default=2, ge=0, le=5)
    qloo_verify_query: str = Field(default="music", min_length=1, max_length=100)

    backend_port: int = Field(default=8000, ge=1, le=65535)
    log_level: str = "INFO"
    cors_origins: Annotated[list[str], NoDecode] = Field(default_factory=list)

    @field_validator("qloo_api_key", mode="before")
    @classmethod
    def _blank_key_is_unconfigured(cls, value: Any) -> Any:
        if value is None:
            return None
        raw = value.get_secret_value() if isinstance(value, SecretStr) else str(value)
        return raw.strip() or None

    @field_validator("qloo_base_url")
    @classmethod
    def _validate_base_url(cls, value: str) -> str:
        value = value.strip().rstrip("/")
        if not value.startswith(("https://", "http://")):
            raise ValueError("QLOO_BASE_URL must start with https:// (or http:// for local tests)")
        return value

    @field_validator("log_level")
    @classmethod
    def _validate_log_level(cls, value: str) -> str:
        level = value.strip().upper()
        if level not in {"CRITICAL", "ERROR", "WARNING", "INFO", "DEBUG"}:
            raise ValueError("LOG_LEVEL must be one of CRITICAL, ERROR, WARNING, INFO, DEBUG")
        return level

    @field_validator("cors_origins", mode="before")
    @classmethod
    def _split_origins(cls, value: Any) -> Any:
        if value is None:
            return []
        if isinstance(value, str):
            return [part.strip() for part in value.split(",") if part.strip()]
        return value

    @property
    def qloo_configured(self) -> bool:
        return self.qloo_api_key is not None

    def qloo_key_value(self) -> str | None:
        """The only place the raw key is exposed; used solely to build the auth header."""
        return self.qloo_api_key.get_secret_value() if self.qloo_api_key else None


@lru_cache
def get_settings() -> Settings:
    return Settings()
