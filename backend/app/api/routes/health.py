from __future__ import annotations

from datetime import UTC, datetime

from fastapi import APIRouter, Request

from app.core.config import APP_VERSION
from app.schemas.common import HealthResponse, ReadinessResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Liveness: the process is running. Never touches Qloo."""
    return HealthResponse(
        status="ok", service="commonground-backend", version=APP_VERSION, time=datetime.now(UTC)
    )


@router.get("/ready", response_model=ReadinessResponse)
async def ready(request: Request) -> ReadinessResponse:
    """Readiness: configuration loaded and the app can serve. A missing key is not a failure."""
    return ReadinessResponse(
        status="ok", qloo_configured=request.app.state.settings.qloo_configured
    )
