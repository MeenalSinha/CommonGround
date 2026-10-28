from __future__ import annotations

import httpx
import pytest

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
from app.integrations.qloo.client import QlooClient
from tests.conftest import FAKE_KEY, Recorder, make_settings, no_sleep

OK_BODY = {"results": [{"entity_id": "E1", "name": "Entity One", "subtype": "urn:entity:artist"}]}
INSIGHTS_BODY = {
    "success": True,
    "results": {
        "entities": [{"entity_id": "R1", "name": "Rec One", "subtype": "urn:entity:movie"}]
    },
    "duration": 7,
}


def make_client(recorder: Recorder, **settings: object) -> QlooClient:
    s = make_settings(qloo_api_key=FAKE_KEY, **settings)
    return QlooClient(s, transport=recorder.transport, sleep=no_sleep)


async def test_search_url_params_and_auth_header() -> None:
    rec = Recorder(lambda r: httpx.Response(200, json=OK_BODY))
    client = make_client(rec)
    result = await client.search_entities("Beyonce", types=["urn:entity:artist"], take=5, page=2)
    req = rec.requests[0]
    assert req.url.host == "qloo.test" and req.url.path == "/search"
    assert req.url.params["query"] == "Beyonce"
    assert req.url.params["take"] == "5" and req.url.params["page"] == "2"
    assert req.url.params["types"] == "urn:entity:artist"
    assert req.headers["X-Api-Key"] == FAKE_KEY
    assert FAKE_KEY not in str(req.url)  # never in the URL
    assert result.entities[0].entity_id == "E1"
    await client.aclose()


async def test_missing_key_makes_no_request() -> None:
    rec = Recorder(lambda r: httpx.Response(200, json=OK_BODY))
    client = QlooClient(make_settings(), transport=rec.transport)
    with pytest.raises(QlooNotConfiguredError):
        await client.search_entities("x")
    with pytest.raises(QlooNotConfiguredError):
        await client.get_insights(filter_type="urn:entity:movie", entity_ids=["E1"])
    assert rec.requests == []
    await client.aclose()


async def test_search_empty_results() -> None:
    rec = Recorder(lambda r: httpx.Response(200, json={"results": []}))
    result = await make_client(rec).search_entities("zzz")
    assert result.entities == [] and result.no_results_status is False


async def test_search_documented_404_is_empty_not_failure() -> None:
    rec = Recorder(lambda r: httpx.Response(404, json={"message": "No results"}))
    result = await make_client(rec).search_entities("zzz")
    assert result.entities == [] and result.no_results_status is True
    assert len(rec.requests) == 1


async def test_insights_params_and_parsing() -> None:
    rec = Recorder(lambda r: httpx.Response(200, json=INSIGHTS_BODY))
    result = await make_client(rec).get_insights(
        filter_type="urn:entity:movie",
        entity_ids=["E1", "E2"],
        tag_ids=["urn:tag:genre:media:comedy"],
        take=3,
        offset=6,
    )
    req = rec.requests[0]
    assert req.url.path == "/v2/insights"
    p = req.url.params
    assert p["filter.type"] == "urn:entity:movie"
    assert p["signal.interests.entities"] == "E1,E2"
    assert p["signal.interests.tags"] == "urn:tag:genre:media:comedy"
    assert p["take"] == "3" and p["offset"] == "6"
    assert result.entities[0].entity_id == "R1" and result.upstream_duration_ms == 7


async def test_insights_empty_is_distinct_from_failure() -> None:
    rec = Recorder(
        lambda r: httpx.Response(200, json={"success": True, "results": {"entities": []}})
    )
    result = await make_client(rec).get_insights(filter_type="urn:entity:book", entity_ids=["E1"])
    assert result.entities == []


@pytest.mark.parametrize(
    "kwargs",
    [
        {"filter_type": "urn:entity:nonsense", "entity_ids": ["E1"]},
        {"filter_type": "urn:entity:movie"},
        {"filter_type": "urn:entity:destination", "tag_ids": ["t"]},
        {"filter_type": "urn:entity:movie", "entity_ids": ["E1"], "take": 0},
        {"filter_type": "urn:entity:movie", "entity_ids": ["E1"], "offset": -1},
    ],
)
async def test_insights_input_validation_makes_no_request(kwargs: dict[str, object]) -> None:
    rec = Recorder(lambda r: httpx.Response(200, json=INSIGHTS_BODY))
    with pytest.raises(QlooBadRequestError):
        await make_client(rec).get_insights(**kwargs)  # type: ignore[arg-type]
    assert rec.requests == []


@pytest.mark.parametrize(
    "kwargs",
    [
        {"query": "  "},
        {"query": "a", "take": 0},
        {"query": "a", "take": 101},
        {"query": "a", "page": 0},
        {"query": "a", "types": ["bogus"]},
    ],
)
async def test_search_input_validation(kwargs: dict[str, object]) -> None:
    rec = Recorder(lambda r: httpx.Response(200, json=OK_BODY))
    with pytest.raises(QlooBadRequestError):
        await make_client(rec).search_entities(**kwargs)  # type: ignore[arg-type]
    assert rec.requests == []


@pytest.mark.parametrize("status", [401, 403])
async def test_auth_errors_are_classified_and_not_retried(status: int) -> None:
    rec = Recorder(lambda r: httpx.Response(status, json={"message": "no"}))
    with pytest.raises(QlooAuthError):
        await make_client(rec).search_entities("x")
    assert len(rec.requests) == 1


async def test_rate_limit_not_retried_and_retry_after_preserved() -> None:
    rec = Recorder(lambda r: httpx.Response(429, headers={"Retry-After": "7"}))
    with pytest.raises(QlooRateLimitedError) as info:
        await make_client(rec).search_entities("x")
    assert info.value.headers == {"Retry-After": "7"}
    assert len(rec.requests) == 1


async def test_transient_5xx_is_retried_then_succeeds() -> None:
    responses = iter([httpx.Response(503), httpx.Response(200, json=OK_BODY)])
    rec = Recorder(lambda r: next(responses))
    result = await make_client(rec).search_entities("x")
    assert len(rec.requests) == 2 and result.entities[0].entity_id == "E1"


async def test_persistent_5xx_is_bounded() -> None:
    rec = Recorder(lambda r: httpx.Response(500 + 2))
    with pytest.raises(QlooUpstreamError):
        await make_client(rec, qloo_max_retries=2).search_entities("x")
    assert len(rec.requests) == 3


async def test_500_is_not_retried() -> None:
    rec = Recorder(lambda r: httpx.Response(500))
    with pytest.raises(QlooUpstreamError):
        await make_client(rec).search_entities("x")
    assert len(rec.requests) == 1


async def test_timeouts_are_bounded_and_classified() -> None:
    def handler(r: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=r)

    rec = Recorder(handler)
    with pytest.raises(QlooTimeoutError):
        await make_client(rec, qloo_max_retries=1).search_entities("x")
    assert len(rec.requests) == 2


async def test_network_failure_is_classified() -> None:
    def handler(r: httpx.Request) -> httpx.Response:
        raise httpx.ConnectError("dns", request=r)

    rec = Recorder(handler)
    with pytest.raises(QlooNetworkError):
        await make_client(rec, qloo_max_retries=0).search_entities("x")
    assert len(rec.requests) == 1


async def test_malformed_json() -> None:
    rec = Recorder(lambda r: httpx.Response(200, content=b"{not json"))
    with pytest.raises(QlooInvalidResponseError):
        await make_client(rec).search_entities("x")


async def test_unexpected_structure() -> None:
    rec = Recorder(lambda r: httpx.Response(200, json={"surprise": True}))
    with pytest.raises(QlooInvalidResponseError):
        await make_client(rec).get_insights(filter_type="urn:entity:movie", entity_ids=["E1"])


async def test_upstream_400_maps_to_rejected_request() -> None:
    rec = Recorder(lambda r: httpx.Response(400, json={"message": "bad"}))
    with pytest.raises(QlooBadRequestError):
        await make_client(rec).get_insights(filter_type="urn:entity:movie", entity_ids=["E1"])
