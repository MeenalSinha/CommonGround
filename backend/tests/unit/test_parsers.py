from __future__ import annotations

import pytest

from app.core.errors import QlooInvalidResponseError
from app.integrations.qloo.parsers import parse_entities, parse_entity

INSIGHTS_PAYLOAD = {
    "success": True,
    "results": {
        "entities": [
            {
                "name": "Sample Film",
                "entity_id": "ID-1",
                "type": "urn:entity",
                "subtype": "urn:entity:movie",
                "properties": {
                    "release_year": 2022,
                    "description": "A test description.",
                    "image": {"url": "https://img.test/1.jpg"},
                },
                "popularity": 0.5,
                "tags": [
                    {
                        "id": "urn:tag:genre:media:comedy",
                        "name": "Comedy",
                        "type": "urn:tag:genre:media",
                    }
                ],
            }
        ]
    },
    "duration": 22,
}


def test_parses_insights_shape() -> None:
    entities, duration = parse_entities(INSIGHTS_PAYLOAD)
    assert duration == 22
    e = entities[0]
    assert (e.entity_id, e.name, e.entity_type) == ("ID-1", "Sample Film", "urn:entity:movie")
    assert e.image_url == "https://img.test/1.jpg"
    assert e.release_year == 2022
    assert e.tags[0].tag_id == "urn:tag:genre:media:comedy"


def test_parses_list_results_container() -> None:
    entities, _ = parse_entities(
        {"results": [{"entity_id": "A", "name": "Alpha", "types": ["urn:entity:artist"]}]}
    )
    assert entities[0].entity_type == "urn:entity:artist"


def test_missing_optionals_are_absent_not_invented() -> None:
    e = parse_entity({"entity_id": "A", "name": "Alpha"})
    assert e is not None
    assert e.description is None and e.image_url is None and e.popularity is None
    assert e.tags == [] and e.entity_type is None


def test_entity_without_identity_is_skipped() -> None:
    assert parse_entity({"name": "No id"}) is None
    assert parse_entity("nonsense") is None


def test_empty_results_is_valid() -> None:
    entities, _ = parse_entities({"results": {"entities": []}})
    assert entities == []


@pytest.mark.parametrize(
    "payload", [[], "x", {"nope": 1}, {"results": "bad"}, {"results": {"entities": "bad"}}]
)
def test_unexpected_structures_rejected(payload: object) -> None:
    with pytest.raises(QlooInvalidResponseError):
        parse_entities(payload)


def test_results_with_no_usable_entity_rejected() -> None:
    with pytest.raises(QlooInvalidResponseError):
        parse_entities({"results": [{"foo": "bar"}]})
