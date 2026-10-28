from __future__ import annotations

from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.api.deps import get_qloo_service
from app.core.errors import QlooBadRequestError
from app.integrations.qloo.constants import ENTITY_TYPES
from app.schemas.qloo import EntitySearchResponse, RecommendationsResponse
from app.schemas.status import QlooStatusResponse
from app.services.qloo_service import QlooService

router = APIRouter(prefix="/api/v1", tags=["qloo"])

ServiceDep = Annotated[QlooService, Depends(get_qloo_service)]


def _split(values: list[str]) -> list[str]:
    """Accept repeated params and comma-separated values; drop blanks and duplicates in order."""
    seen: dict[str, None] = {}
    for value in values:
        for part in value.split(","):
            part = part.strip()
            if part:
                seen.setdefault(part)
    return list(seen)


@router.get("/integrations/qloo/status", response_model=QlooStatusResponse)
async def qloo_status(service: ServiceDep) -> QlooStatusResponse:
    """Current evidence-based status. Does not call Qloo."""
    return service.status()


@router.post("/integrations/qloo/verify", response_model=QlooStatusResponse)
async def qloo_verify(service: ServiceDep) -> QlooStatusResponse:
    """Explicit live verification (one minimal request). Fails with 503 if no key is configured."""
    return await service.verify()


@router.get("/qloo/entity-types")
async def entity_types() -> dict[str, list[str]]:
    """Entity types verified against Qloo's documentation."""
    return {"types": list(ENTITY_TYPES)}


@router.get("/qloo/entities/search", response_model=EntitySearchResponse)
async def search_entities(
    service: ServiceDep,
    query: Annotated[str, Query(min_length=1, max_length=100, description="Text to search for")],
    types: Annotated[
        list[str] | None, Query(description="Entity type URNs; repeat or comma-separate")
    ] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    page: Annotated[int, Query(ge=1, le=100)] = 1,
) -> EntitySearchResponse:
    return await service.search(query, types=_split(types or []), limit=limit, page=page)


@router.get("/qloo/insights/recommendations", response_model=RecommendationsResponse)
async def recommendations(
    service: ServiceDep,
    type: Annotated[
        str, Query(min_length=1, max_length=64, description="Entity type URN to recommend")
    ],
    entity_ids: Annotated[
        list[str] | None, Query(description="Qloo entity ids used as signals")
    ] = None,
    tag_ids: Annotated[list[str] | None, Query(description="Qloo tag ids used as signals")] = None,
    limit: Annotated[int, Query(ge=1, le=50)] = 10,
    offset: Annotated[int, Query(ge=0, le=1000)] = 0,
) -> RecommendationsResponse:
    ids = _split(entity_ids or [])
    tags = _split(tag_ids or [])
    if len(ids) > 20 or len(tags) > 20:
        raise QlooBadRequestError("At most 20 entity ids and 20 tag ids are accepted per request.")
    return await service.recommendations(
        filter_type=type, entity_ids=ids, tag_ids=tags, limit=limit, offset=offset
    )
