"""Application service: orchestrates the client, status tracking and public-model mapping."""

from __future__ import annotations

from datetime import UTC, datetime

from app.core.config import Settings
from app.core.errors import AppError
from app.integrations.qloo.client import QlooClient
from app.integrations.qloo.constants import INSIGHTS_PATH, SEARCH_PATH
from app.integrations.qloo.models import QlooEntity
from app.schemas.qloo import (
    Entity,
    EntitySearchResponse,
    Provenance,
    RecommendationsResponse,
    Tag,
)
from app.schemas.status import QlooStatusResponse
from app.services.status_tracker import StatusTracker


def _to_entity(e: QlooEntity) -> Entity:
    return Entity(
        id=e.entity_id,
        name=e.name,
        type=e.entity_type,
        description=e.description,
        image_url=e.image_url,
        popularity=e.popularity,
        release_year=e.release_year,
        tags=[Tag(id=t.tag_id, name=t.name, type=t.tag_type) for t in e.tags],
    )


class QlooService:
    def __init__(self, settings: Settings, client: QlooClient, tracker: StatusTracker) -> None:
        self._settings = settings
        self._client = client
        self._tracker = tracker

    def status(self) -> QlooStatusResponse:
        """Never contacts Qloo."""
        return self._tracker.snapshot()

    async def verify(self) -> QlooStatusResponse:
        """Explicit, bounded live check: one minimal read-only search request."""
        await self.search(self._settings.qloo_verify_query, types=[], limit=1, page=1)
        return self._tracker.snapshot()

    async def search(
        self, query: str, *, types: list[str], limit: int, page: int
    ) -> EntitySearchResponse:
        try:
            result = await self._client.search_entities(query, types=types, take=limit, page=page)
        except AppError as exc:
            self._tracker.record_error(exc)
            raise
        if result.no_results_status:
            self._tracker.record_inconclusive()
        else:
            self._tracker.record_success()
        params: dict[str, str | int | list[str]] = {
            "query": query.strip(),
            "take": limit,
            "page": page,
        }
        if types:
            params["types"] = types
        items = [_to_entity(e) for e in result.entities]
        return EntitySearchResponse(
            items=items,
            count=len(items),
            page=page,
            limit=limit,
            empty=not items,
            provenance=self._provenance(SEARCH_PATH, result.upstream_duration_ms, params),
        )

    async def recommendations(
        self,
        *,
        filter_type: str,
        entity_ids: list[str],
        tag_ids: list[str],
        limit: int,
        offset: int,
    ) -> RecommendationsResponse:
        try:
            result = await self._client.get_insights(
                filter_type=filter_type,
                entity_ids=entity_ids,
                tag_ids=tag_ids,
                take=limit,
                offset=offset,
            )
        except AppError as exc:
            self._tracker.record_error(exc)
            raise
        self._tracker.record_success()
        params: dict[str, str | int | list[str]] = {
            "filter.type": filter_type,
            "take": limit,
            "offset": offset,
        }
        if entity_ids:
            params["signal.interests.entities"] = entity_ids
        if tag_ids:
            params["signal.interests.tags"] = tag_ids
        items = [_to_entity(e) for e in result.entities]
        return RecommendationsResponse(
            items=items,
            count=len(items),
            filter_type=filter_type,
            signal_entity_ids=entity_ids,
            signal_tag_ids=tag_ids,
            limit=limit,
            offset=offset,
            empty=not items,
            provenance=self._provenance(INSIGHTS_PATH, result.upstream_duration_ms, params),
        )

    @staticmethod
    def _provenance(
        endpoint: str, duration: int | None, params: dict[str, str | int | list[str]]
    ) -> Provenance:
        return Provenance(
            endpoint=endpoint,
            retrieved_at=datetime.now(UTC),
            upstream_duration_ms=duration,
            parameters=params,
        )
