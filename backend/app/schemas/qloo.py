"""Public (mobile-facing) Qloo models. Independent of upstream payload shapes."""

from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class Tag(BaseModel):
    id: str
    name: str | None = None
    type: str | None = None


class Entity(BaseModel):
    id: str = Field(description="Qloo entity id; preserved verbatim from the upstream response")
    name: str
    type: str | None = None
    description: str | None = None
    image_url: str | None = None
    popularity: float | None = None
    release_year: int | None = None
    tags: list[Tag] = Field(default_factory=list)


class Provenance(BaseModel):
    source: str = "qloo"
    endpoint: str
    retrieved_at: datetime
    upstream_duration_ms: int | None = None
    parameters: dict[str, str | int | list[str]]


class EntitySearchResponse(BaseModel):
    items: list[Entity]
    count: int
    page: int
    limit: int
    empty: bool
    provenance: Provenance


class RecommendationsResponse(BaseModel):
    items: list[Entity]
    count: int
    filter_type: str
    signal_entity_ids: list[str]
    signal_tag_ids: list[str]
    limit: int
    offset: int
    empty: bool
    provenance: Provenance
