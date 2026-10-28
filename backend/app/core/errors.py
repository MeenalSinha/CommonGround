"""Application error types and the single public error envelope.

Every error returned to the mobile app has the shape::

    {"error": {"code": "...", "message": "...", "request_id": "...", "details": {...}}}

Messages are user-safe; internal exception text and tracebacks are never exposed.
"""

from __future__ import annotations

from typing import Any


class AppError(Exception):
    status_code: int = 500
    code: str = "internal_error"
    message: str = "Something went wrong on our side."

    def __init__(
        self,
        message: str | None = None,
        *,
        details: dict[str, Any] | None = None,
        headers: dict[str, str] | None = None,
    ) -> None:
        super().__init__(message or self.message)
        self.message = message or self.message
        self.details = details or {}
        self.headers = headers or {}


class QlooNotConfiguredError(AppError):
    status_code = 503
    code = "qloo_not_configured"
    message = (
        "The Qloo cultural engine is not configured yet. Add QLOO_API_KEY to the backend "
        "environment and restart the server."
    )


class QlooAuthError(AppError):
    status_code = 502
    code = "qloo_auth_failed"
    message = "Qloo rejected the configured credentials. Check the API key and base URL."


class QlooRateLimitedError(AppError):
    status_code = 429
    code = "qloo_rate_limited"
    message = "Qloo is rate limiting requests. Please wait a moment and try again."


class QlooTimeoutError(AppError):
    status_code = 504
    code = "qloo_timeout"
    message = "Qloo took too long to respond."


class QlooNetworkError(AppError):
    status_code = 502
    code = "qloo_unreachable"
    message = "The backend could not reach Qloo."


class QlooUpstreamError(AppError):
    status_code = 502
    code = "qloo_upstream_error"
    message = "Qloo returned an error."


class QlooInvalidResponseError(AppError):
    status_code = 502
    code = "qloo_invalid_response"
    message = "Qloo returned a response the backend could not understand."


class QlooBadRequestError(AppError):
    status_code = 422
    code = "qloo_rejected_request"
    message = "Qloo rejected the request parameters."
