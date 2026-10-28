"""Normalized models produced by the integration layer.

These are the integration's output types. Upstream payload shapes never leave this package.
Optional fields stay ``None`` / empty when Qloo does not return them; nothing is invented.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class QlooTag(BaseModel):
    tag_id: str
    name: str | None = None
    tag_type: str | None = None


class QlooEntity(BaseModel):
    entity_id: str
    name: str
    entity_type: str | None = Field(
        default=None, description="Qloo subtype URN, e.g. urn:entity:movie"
    )
    description: str | None = None
    image_url: str | None = None
    popularity: float | None = None
    release_year: int | None = None
    tags: list[QlooTag] = Field(default_factory=list)


class QlooSearchResult(BaseModel):
    entities: list[QlooEntity]
    page: int
    take: int
    upstream_duration_ms: int | None = None
    # True when Qloo answered the documented "404 No results" instead of a 200 payload.
    no_results_status: bool = False


class QlooInsightsResult(BaseModel):
    entities: list[QlooEntity]
    filter_type: str
    signal_entity_ids: list[str]
    signal_tag_ids: list[str]
    take: int
    offset: int
    upstream_duration_ms: int | None = None
