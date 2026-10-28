"""Verified Qloo API facts (see docs/API_CONTRACT.md for sources and open questions)."""

from __future__ import annotations

API_KEY_HEADER = "X-Api-Key"

# Verified from the official docs repo (reference/get-search.md, reference/api-overview.md).
SEARCH_PATH = "/search"
INSIGHTS_PATH = "/v2/insights"

# Verified from reference/insights-api-deep-dive.md (filter.type allowed values).
# "urn:heatmap" is also listed there but is not an entity type and is excluded on purpose.
ENTITY_TYPES: tuple[str, ...] = (
    "urn:entity:artist",
    "urn:entity:book",
    "urn:entity:brand",
    "urn:entity:destination",
    "urn:entity:movie",
    "urn:entity:person",
    "urn:entity:place",
    "urn:entity:podcast",
    "urn:entity:tv_show",
    "urn:entity:videogame",
)

# Per reference/available-parameters-by-entity-type.md, signal.interests.entities is
# required for these entity types when calling /v2/insights.
SIGNAL_REQUIRED_TYPES: frozenset[str] = frozenset({"urn:entity:destination"})

# Documented bounds for the search "take" parameter (1 to 100).
SEARCH_TAKE_MIN = 1
SEARCH_TAKE_MAX = 100
