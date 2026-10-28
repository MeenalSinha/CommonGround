"""Evidence-based integration status.

State only advances to READY after a genuine successful upstream request. A configured key is
never treated as proof that Qloo works. Observations from ordinary requests update the state too.
"""

from __future__ import annotations

from datetime import UTC, datetime
from urllib.parse import urlparse

from app.core.config import Settings
from app.core.errors import (
    AppError,
    QlooAuthError,
    QlooInvalidResponseError,
    QlooNetworkError,
    QlooRateLimitedError,
    QlooTimeoutError,
    QlooUpstreamError,
)
from app.schemas.status import IntegrationState, QlooStatusResponse

_MESSAGES: dict[IntegrationState, str] = {
    IntegrationState.NOT_CONFIGURED: (
        "The cultural engine is being connected. Live discoveries are not available until a "
        "Qloo API key is added to the backend."
    ),
    IntegrationState.PENDING_VERIFICATION: (
        "A Qloo key is present, but no live request has succeeded yet. Run verification to confirm."
    ),
    IntegrationState.READY: "Qloo responded successfully. The cultural engine is ready.",
    IntegrationState.AUTH_FAILED: "Qloo rejected the configured credentials.",
    IntegrationState.RATE_LIMITED: "Qloo is rate limiting requests. Try again shortly.",
    IntegrationState.UNAVAILABLE: "The last attempt to reach Qloo failed. Retry in a moment.",
}

_UNAVAILABLE_ERRORS = (
    QlooTimeoutError,
    QlooNetworkError,
    QlooUpstreamError,
    QlooInvalidResponseError,
)


class StatusTracker:
    def __init__(self, settings: Settings) -> None:
        self._settings = settings
        self._state = (
            IntegrationState.PENDING_VERIFICATION
            if settings.qloo_configured
            else IntegrationState.NOT_CONFIGURED
        )
        self._last_checked_at: datetime | None = None
        self._last_verified_at: datetime | None = None
        self._last_error_code: str | None = None

    def record_success(self) -> None:
        now = datetime.now(UTC)
        self._state = IntegrationState.READY
        self._last_checked_at = now
        self._last_verified_at = now
        self._last_error_code = None

    def record_inconclusive(self) -> None:
        """A request completed but proved nothing about authentication (e.g. documented 404)."""
        self._last_checked_at = datetime.now(UTC)

    def record_error(self, error: AppError) -> None:
        self._last_checked_at = datetime.now(UTC)
        if isinstance(error, QlooAuthError):
            self._state = IntegrationState.AUTH_FAILED
        elif isinstance(error, QlooRateLimitedError):
            self._state = IntegrationState.RATE_LIMITED
        elif isinstance(error, _UNAVAILABLE_ERRORS):
            self._state = IntegrationState.UNAVAILABLE
        else:
            return  # our own validation errors say nothing about the integration
        self._last_error_code = error.code

    def snapshot(self) -> QlooStatusResponse:
        host = urlparse(self._settings.qloo_base_url).hostname
        return QlooStatusResponse(
            state=self._state,
            configured=self._settings.qloo_configured,
            ready=self._state is IntegrationState.READY,
            message=_MESSAGES[self._state],
            base_host=host,
            last_checked_at=self._last_checked_at,
            last_verified_at=self._last_verified_at,
            last_error_code=self._last_error_code,
        )
