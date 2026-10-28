from __future__ import annotations

from datetime import datetime
from enum import StrEnum

from pydantic import BaseModel


class IntegrationState(StrEnum):
    NOT_CONFIGURED = "not_configured"
    PENDING_VERIFICATION = "pending_verification"
    READY = "ready"
    AUTH_FAILED = "auth_failed"
    RATE_LIMITED = "rate_limited"
    UNAVAILABLE = "unavailable"


class QlooStatusResponse(BaseModel):
    state: IntegrationState
    configured: bool
    ready: bool
    message: str
    base_host: str | None = None
    last_checked_at: datetime | None = None
    last_verified_at: datetime | None = None
    last_error_code: str | None = None
