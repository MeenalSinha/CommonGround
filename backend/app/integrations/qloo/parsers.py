"""Defensive parsing of upstream Qloo payloads into normalized models.

Insights shape (verified from official docs examples):
    {"success": true, "results": {"entities": [{"name", "entity_id", "type", "subtype",
     "properties": {...}, "popularity", "tags": [...]}]}, "duration": 22}

Search shape: the official reference page does not publish a response example, so the parser
accepts the two plausible containers (``results`` as a list, or ``results.entities``) and the
same entity keys. Anything outside that raises QlooInvalidResponseError rather than guessing.
"""

from __future__ import annotations

from typing import Any

from app.core.errors import QlooInvalidResponseError
from app.integrations.qloo.models import QlooEntity, QlooTag


def _as_str(value: Any) -> str | None:
    return value if isinstance(value, str) and value.strip() else None


def _as_float(value: Any) -> float | None:
    return float(value) if isinstance(value, int | float) and not isinstance(value, bool) else None


def _as_int(value: Any) -> int | None:
    return value if isinstance(value, int) and not isinstance(value, bool) else None


def _parse_tags(raw: Any) -> list[QlooTag]:
    tags: list[QlooTag] = []
    if not isinstance(raw, list):
        return tags
    for item in raw:
        if not isinstance(item, dict):
            continue
        tag_id = _as_str(item.get("id"))
        if tag_id is None:
            continue
        tags.append(
            QlooTag(
                tag_id=tag_id, name=_as_str(item.get("name")), tag_type=_as_str(item.get("type"))
            )
        )
    return tags


def _entity_type(raw: dict[str, Any]) -> str | None:
    subtype = _as_str(raw.get("subtype"))
    if subtype:
        return subtype
    types = raw.get("types")
    if isinstance(types, list):
        for item in types:
            if isinstance(item, str) and item.startswith("urn:entity:") and item != "urn:entity":
                return item
    type_value = _as_str(raw.get("type"))
    if type_value and type_value != "urn:entity":
        return type_value
    return None


def parse_entity(raw: Any) -> QlooEntity | None:
    """Parse one entity. Returns None when the minimum identity (id and name) is missing."""
    if not isinstance(raw, dict):
        return None
    entity_id = _as_str(raw.get("entity_id")) or _as_str(raw.get("id"))
    name = _as_str(raw.get("name"))
    if entity_id is None or name is None:
        return None
    props = raw.get("properties")
    props = props if isinstance(props, dict) else {}
    image = props.get("image")
    image_url = _as_str(image.get("url")) if isinstance(image, dict) else _as_str(image)
    return QlooEntity(
        entity_id=entity_id,
        name=name,
        entity_type=_entity_type(raw),
        description=_as_str(props.get("description")) or _as_str(raw.get("description")),
        image_url=image_url,
        popularity=_as_float(raw.get("popularity")),
        release_year=_as_int(props.get("release_year")),
        tags=_parse_tags(raw.get("tags")),
    )


def _extract_entity_list(payload: Any) -> list[Any]:
    if not isinstance(payload, dict):
        raise QlooInvalidResponseError("Qloo response was not a JSON object.")
    results = payload.get("results")
    if isinstance(results, list):
        return results
    if isinstance(results, dict):
        nested = results.get("entities")
        if isinstance(nested, list):
            return nested
    raise QlooInvalidResponseError("Qloo response did not contain a results list.")


def parse_entities(payload: Any) -> tuple[list[QlooEntity], int | None]:
    items = _extract_entity_list(payload)
    entities = [e for e in (parse_entity(item) for item in items) if e is not None]
    if items and not entities:
        raise QlooInvalidResponseError("Qloo returned results but none contained an id and name.")
    duration = payload.get("duration")
    return entities, duration if isinstance(duration, int) and not isinstance(
        duration, bool
    ) else None
