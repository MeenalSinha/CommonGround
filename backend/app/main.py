"""FastAPI application factory."""

from __future__ import annotations

import logging
import uuid
from collections.abc import AsyncIterator, Awaitable, Callable
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, Request, Response
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from app.api.routes import health, qloo
from app.core.config import APP_VERSION, Settings, get_settings
from app.core.errors import AppError
from app.core.logging import configure_logging, log_fields, request_id_ctx
from app.integrations.qloo.client import QlooClient
from app.schemas.common import ErrorBody, ErrorEnvelope
from app.services.qloo_service import QlooService
from app.services.status_tracker import StatusTracker

logger = logging.getLogger("app")


def _envelope(
    request: Request,
    status_code: int,
    code: str,
    message: str,
    details: dict[str, object] | None = None,
    headers: dict[str, str] | None = None,
) -> JSONResponse:
    body = ErrorEnvelope(
        error=ErrorBody(
            code=code,
            message=message,
            request_id=getattr(request.state, "request_id", None),
            details=details or {},
        )
    )
    return JSONResponse(status_code=status_code, content=jsonable_encoder(body), headers=headers)


def create_app(
    settings: Settings | None = None,
    *,
    qloo_transport: httpx.AsyncBaseTransport | None = None,
) -> FastAPI:
    settings = settings or get_settings()
    secrets = [s for s in [settings.qloo_key_value()] if s]
    configure_logging(settings.log_level, secrets)

    client = QlooClient(settings, transport=qloo_transport)
    tracker = StatusTracker(settings)
    service = QlooService(settings, client, tracker)

    @asynccontextmanager
    async def lifespan(_: FastAPI) -> AsyncIterator[None]:
        logger.info(
            "backend starting",
            extra=log_fields(qloo_configured=settings.qloo_configured, version=APP_VERSION),
        )
        yield
        await client.aclose()

    app = FastAPI(title="CommonGround API", version=APP_VERSION, lifespan=lifespan)
    app.state.settings = settings
    app.state.qloo_service = service

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_methods=["GET", "POST"],
        allow_headers=["Content-Type", "X-Request-ID"],
    )

    @app.middleware("http")
    async def request_context(
        request: Request, call_next: Callable[[Request], Awaitable[Response]]
    ) -> Response:
        rid = request.headers.get("X-Request-ID") or uuid.uuid4().hex
        request.state.request_id = rid
        token = request_id_ctx.set(rid)
        try:
            response = await call_next(request)
        finally:
            request_id_ctx.reset(token)
        response.headers["X-Request-ID"] = rid
        return response

    @app.exception_handler(AppError)
    async def handle_app_error(request: Request, exc: AppError) -> JSONResponse:
        logger.warning(
            "request failed",
            extra=log_fields(code=exc.code, status=exc.status_code, path=request.url.path),
        )
        return _envelope(request, exc.status_code, exc.code, exc.message, exc.details, exc.headers)

    @app.exception_handler(RequestValidationError)
    async def handle_validation(request: Request, exc: RequestValidationError) -> JSONResponse:
        issues = [
            {
                "field": ".".join(str(p) for p in err["loc"][1:]) or str(err["loc"][0]),
                "message": err["msg"],
            }
            for err in exc.errors()
        ]
        return _envelope(
            request, 422, "validation_error", "The request was not valid.", {"issues": issues}
        )

    @app.exception_handler(StarletteHTTPException)
    async def handle_http(request: Request, exc: StarletteHTTPException) -> JSONResponse:
        code = "not_found" if exc.status_code == 404 else "http_error"
        return _envelope(request, exc.status_code, code, str(exc.detail))

    @app.exception_handler(Exception)
    async def handle_unexpected(request: Request, exc: Exception) -> JSONResponse:
        logger.error(
            "unhandled error",
            exc_info=(type(exc), exc, None),
            extra=log_fields(path=request.url.path),
        )
        return _envelope(request, 500, "internal_error", "Something went wrong on our side.")

    app.include_router(health.router)
    app.include_router(qloo.router)
    return app


def build_default_app() -> FastAPI:
    return create_app()


app = build_default_app()
