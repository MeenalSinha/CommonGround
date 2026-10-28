"""Qloo HTTP client: authentication, bounded retries, error classification, normalization."""

from __future__ import annotations

import asyncio
import json
import logging
import random
from typing import Any

import httpx

from app.core.config import Settings
from app.core.errors import (
    QlooAuthError,
    QlooBadRequestError,
    QlooInvalidResponseError,
    QlooNetworkError,
    QlooNotConfiguredError,
    QlooRateLimitedError,
    QlooTimeoutError,
    QlooUpstreamError,
)
from app.core.logging import log_fields
from app.integrations.qloo.constants import (
    API_KEY_HEADER,
    ENTITY_TYPES,
    INSIGHTS_PATH,
    SEARCH_PATH,
    SEARCH_TAKE_MAX,
    SEARCH_TAKE_MIN,
    SIGNAL_REQUIRED_TYPES,
)
from app.integrations.qloo.models import QlooInsightsResult, QlooSearchResult
from app.integrations.qloo.parsers import parse_entities

logger = logging.getLogger(__name__)

_RETRYABLE_STATUS = {502, 503, 504}


class QlooClient:
    """Minimal verified client: entity search and one Insights operation.

    No request is attempted unless a key is configured. The key is attached only as the
    ``X-Api-Key`` header on each request and is never logged.
    """

    def __init__(
        self,
        settings: Settings,
        *,
        transport: httpx.AsyncBaseTransport | None = None,
        sleep: Any = asyncio.sleep,
    ) -> None:
        self._settings = settings
        self._sleep = sleep
        self._http = httpx.AsyncClient(
            base_url=settings.qloo_base_url,
            timeout=httpx.Timeout(settings.qloo_timeout_seconds),
            transport=transport,
            headers={"Accept": "application/json"},
        )

    async def aclose(self) -> None:
        await self._http.aclose()

    @property
    def configured(self) -> bool:
        return self._settings.qloo_configured

    # ---- public operations -------------------------------------------------------------

    async def search_entities(
        self, query: str, *, types: list[str] | None = None, take: int = 10, page: int = 1
    ) -> QlooSearchResult:
        query = query.strip()
        if not query:
            raise QlooBadRequestError("Search query must not be empty.")
        if not SEARCH_TAKE_MIN <= take <= SEARCH_TAKE_MAX:
            raise QlooBadRequestError(
                f"take must be between {SEARCH_TAKE_MIN} and {SEARCH_TAKE_MAX}."
            )
        if page < 1:
            raise QlooBadRequestError("page must be 1 or greater.")
        self._validate_types(types or [])

        params: dict[str, Any] = {"query": query, "take": take, "page": page}
        if types:
            params["types"] = ",".join(types)

        payload = await self._get(SEARCH_PATH, params, empty_on_404=True)
        if payload is None:  # documented "404 No results"
            return QlooSearchResult(entities=[], page=page, take=take, no_results_status=True)
        entities, duration = parse_entities(payload)
        return QlooSearchResult(
            entities=entities, page=page, take=take, upstream_duration_ms=duration
        )

    async def get_insights(
        self,
        *,
        filter_type: str,
        entity_ids: list[str] | None = None,
        tag_ids: list[str] | None = None,
        take: int = 10,
        offset: int = 0,
    ) -> QlooInsightsResult:
        entity_ids = entity_ids or []
        tag_ids = tag_ids or []
        self._validate_types([filter_type])
        if not entity_ids and not tag_ids:
            raise QlooBadRequestError("Provide at least one entity id or tag id as a signal.")
        if filter_type in SIGNAL_REQUIRED_TYPES and not entity_ids:
            raise QlooBadRequestError(f"{filter_type} requires at least one signal entity id.")
        if take < 1:
            raise QlooBadRequestError("take must be 1 or greater.")
        if offset < 0:
            raise QlooBadRequestError("offset must be 0 or greater.")

        params: dict[str, Any] = {"filter.type": filter_type, "take": take, "offset": offset}
        if entity_ids:
            params["signal.interests.entities"] = ",".join(entity_ids)
        if tag_ids:
            params["signal.interests.tags"] = ",".join(tag_ids)

        payload = await self._get(INSIGHTS_PATH, params)
        assert payload is not None
        entities, duration = parse_entities(payload)
        return QlooInsightsResult(
            entities=entities,
            filter_type=filter_type,
            signal_entity_ids=entity_ids,
            signal_tag_ids=tag_ids,
            take=take,
            offset=offset,
            upstream_duration_ms=duration,
        )

    # ---- internals ---------------------------------------------------------------------

    @staticmethod
    def _validate_types(types: list[str]) -> None:
        unsupported = [t for t in types if t not in ENTITY_TYPES]
        if unsupported:
            raise QlooBadRequestError(
                "Unsupported entity type.",
                details={"unsupported": unsupported, "supported": list(ENTITY_TYPES)},
            )

    async def _get(self, path: str, params: dict[str, Any], *, empty_on_404: bool = False) -> Any:
        key = self._settings.qloo_key_value()
        if key is None:
            raise QlooNotConfiguredError()  # no upstream request is made
        headers = {API_KEY_HEADER: key}
        attempts = self._settings.qloo_max_retries + 1
        last_error: Exception | None = None

        for attempt in range(1, attempts + 1):
            try:
                response = await self._http.get(path, params=params, headers=headers)
            except httpx.TimeoutException as exc:
                last_error = QlooTimeoutError()
                self._log_failure(path, "timeout", attempt, attempts)
                last_error.__cause__ = exc
            except httpx.TransportError as exc:
                last_error = QlooNetworkError()
                self._log_failure(path, "network", attempt, attempts)
                last_error.__cause__ = exc
            else:
                status = response.status_code
                if status == 200:
                    return self._decode_json(response)
                if status == 404 and empty_on_404:
                    return None
                if status in _RETRYABLE_STATUS:
                    last_error = QlooUpstreamError(details={"upstream_status": status})
                    self._log_failure(path, f"http_{status}", attempt, attempts)
                else:
                    raise self._classify(status, response)
            if attempt < attempts:
                await self._sleep(self._backoff(attempt))
        assert last_error is not None
        raise last_error

    @staticmethod
    def _decode_json(response: httpx.Response) -> Any:
        try:
            return response.json()
        except (json.JSONDecodeError, ValueError) as exc:
            raise QlooInvalidResponseError("Qloo returned malformed JSON.") from exc

    @staticmethod
    def _classify(status: int, response: httpx.Response) -> Exception:
        if status in (401, 403):
            return QlooAuthError(details={"upstream_status": status})
        if status == 429:
            retry_after = response.headers.get("Retry-After")
            headers = {"Retry-After": retry_after} if retry_after else {}
            return QlooRateLimitedError(details={"upstream_status": status}, headers=headers)
        if status in (400, 422):
            return QlooBadRequestError(details={"upstream_status": status})
        return QlooUpstreamError(details={"upstream_status": status})

    @staticmethod
    def _backoff(attempt: int) -> float:
        return float(min(2 ** (attempt - 1) * 0.5 + random.uniform(0, 0.25), 4.0))  # noqa: S311

    @staticmethod
    def _log_failure(path: str, reason: str, attempt: int, attempts: int) -> None:
        logger.warning(
            "qloo request failed",
            extra=log_fields(path=path, reason=reason, attempt=attempt, max_attempts=attempts),
        )
