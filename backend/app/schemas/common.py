from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel


class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    time: datetime


class ReadinessResponse(BaseModel):
    status: str
    qloo_configured: bool


class ErrorBody(BaseModel):
    code: str
    message: str
    request_id: str | None = None
    details: dict[str, Any] = {}


class ErrorEnvelope(BaseModel):
    error: ErrorBody
