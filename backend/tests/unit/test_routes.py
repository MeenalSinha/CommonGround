from __future__ import annotations

import json
import logging

import httpx
import pytest
from fastapi.testclient import TestClient

from app.core.logging import JsonFormatter, RedactionFilter
from app.main import create_app
from tests.conftest import FAKE_KEY, Recorder, make_settings

SEARCH_BODY = {
    "results": [
        {
            "entity_id": "E1",
            "name": "Entity One",
            "subtype": "urn:entity:artist",
            "properties": {"description": "Described."},
        }
    ]
}
INSIGHTS_BODY = {
    "success": True,
    "results": {
        "entities": [{"entity_id": "R1", "name": "Rec One", "subtype": "urn:entity:movie"}]
    },
    "duration": 5,
}


def keyless_client() -> tuple[TestClient, Recorder]:
    rec = Recorder(lambda r: httpx.Response(200, json=SEARCH_BODY))
    app = create_app(make_settings(), qloo_transport=rec.transport)
    return TestClient(app), rec


def keyed_client(handler, **settings: object) -> tuple[TestClient, Recorder]:  # type: ignore[no-untyped-def]
    rec = Recorder(handler)
    app = create_app(make_settings(qloo_api_key=FAKE_KEY, **settings), qloo_transport=rec.transport)
    return TestClient(app, raise_server_exceptions=False), rec


def test_health_works_without_key() -> None:
    client, rec = keyless_client()
    with client:
        r = client.get("/health")
    assert r.status_code == 200 and r.json()["status"] == "ok"
    assert rec.requests == []


def test_ready_works_without_key() -> None:
    client, _ = keyless_client()
    with client:
        body = client.get("/ready").json()
    assert body == {"status": "ok", "qloo_configured": False}


def test_status_unconfigured_makes_no_upstream_call() -> None:
    client, rec = keyless_client()
    with client:
        body = client.get("/api/v1/integrations/qloo/status").json()
    assert body["state"] == "not_configured"
    assert body["configured"] is False and body["ready"] is False
    assert body["last_verified_at"] is None
    assert rec.requests == []


def test_search_unconfigured_returns_clear_error_and_no_results() -> None:
    client, rec = keyless_client()
    with client:
        r = client.get("/api/v1/qloo/entities/search", params={"query": "anything"})
    assert r.status_code == 503
    err = r.json()["error"]
    assert err["code"] == "qloo_not_configured" and err["request_id"]
    assert "items" not in r.json()
    assert rec.requests == []


def test_verify_unconfigured_is_503_and_makes_no_request() -> None:
    client, rec = keyless_client()
    with client:
        r = client.post("/api/v1/integrations/qloo/verify")
    assert r.status_code == 503 and r.json()["error"]["code"] == "qloo_not_configured"
    assert rec.requests == []


@pytest.mark.parametrize(
    "params",
    [
        {},
        {"query": ""},
        {"query": "x" * 101},
        {"query": "ok", "limit": 0},
        {"query": "ok", "limit": 51},
        {"query": "ok", "page": 0},
    ],
)
def test_search_validation_errors(params: dict[str, object]) -> None:
    client, rec = keyless_client()
    with client:
        r = client.get("/api/v1/qloo/entities/search", params=params)  # type: ignore[arg-type]
    assert r.status_code == 422
    body = r.json()["error"]
    assert body["code"] == "validation_error" and body["details"]["issues"]
    assert rec.requests == []


def test_search_success_serialization_and_provenance() -> None:
    client, rec = keyed_client(lambda r: httpx.Response(200, json=SEARCH_BODY))
    with client:
        r = client.get(
            "/api/v1/qloo/entities/search",
            params={"query": " Beyonce ", "types": "urn:entity:artist", "limit": 3},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["count"] == 1 and body["empty"] is False
    assert body["items"][0] == {
        "id": "E1",
        "name": "Entity One",
        "type": "urn:entity:artist",
        "description": "Described.",
        "image_url": None,
        "popularity": None,
        "release_year": None,
        "tags": [],
    }
    assert body["provenance"]["source"] == "qloo" and body["provenance"]["endpoint"] == "/search"
    assert rec.requests[0].url.params["query"] == "Beyonce"  # the user query drives the request
    assert FAKE_KEY not in r.text


def test_empty_result_is_success_not_error() -> None:
    client, _ = keyed_client(lambda r: httpx.Response(200, json={"results": []}))
    with client:
        r = client.get("/api/v1/qloo/entities/search", params={"query": "zzz"})
    assert r.status_code == 200 and r.json()["empty"] is True and r.json()["items"] == []


def test_status_pending_then_ready_after_real_success() -> None:
    client, _ = keyed_client(lambda r: httpx.Response(200, json=SEARCH_BODY))
    with client:
        first = client.get("/api/v1/integrations/qloo/status").json()
        assert first["state"] == "pending_verification" and first["ready"] is False
        assert first["configured"] is True
        verified = client.post("/api/v1/integrations/qloo/verify").json()
    assert verified["state"] == "ready" and verified["ready"] is True
    assert verified["last_verified_at"] is not None
    assert FAKE_KEY not in json.dumps(verified)


def test_verify_with_404_no_results_is_not_proof() -> None:
    client, _ = keyed_client(lambda r: httpx.Response(404))
    with client:
        body = client.post("/api/v1/integrations/qloo/verify").json()
    assert body["state"] == "pending_verification" and body["ready"] is False


def test_auth_failure_translated_and_tracked() -> None:
    client, _ = keyed_client(lambda r: httpx.Response(401, json={"echo": FAKE_KEY}))
    with client:
        r = client.get("/api/v1/qloo/entities/search", params={"query": "x"})
        status = client.get("/api/v1/integrations/qloo/status").json()
    assert r.status_code == 502 and r.json()["error"]["code"] == "qloo_auth_failed"
    assert FAKE_KEY not in r.text
    assert status["state"] == "auth_failed" and status["last_error_code"] == "qloo_auth_failed"


def test_rate_limit_translated() -> None:
    client, _ = keyed_client(lambda r: httpx.Response(429, headers={"Retry-After": "3"}))
    with client:
        r = client.get("/api/v1/qloo/entities/search", params={"query": "x"})
        status = client.get("/api/v1/integrations/qloo/status").json()
    assert r.status_code == 429 and r.headers["Retry-After"] == "3"
    assert status["state"] == "rate_limited"


def test_upstream_failure_marks_unavailable() -> None:
    client, _ = keyed_client(lambda r: httpx.Response(500), qloo_max_retries=0)
    with client:
        r = client.get("/api/v1/qloo/entities/search", params={"query": "x"})
        status = client.get("/api/v1/integrations/qloo/status").json()
    assert r.status_code == 502 and status["state"] == "unavailable"


def test_recommendations_success() -> None:
    client, rec = keyed_client(lambda r: httpx.Response(200, json=INSIGHTS_BODY))
    with client:
        r = client.get(
            "/api/v1/qloo/insights/recommendations",
            params={"type": "urn:entity:movie", "entity_ids": "E1,E2", "limit": 4},
        )
    assert r.status_code == 200
    body = r.json()
    assert body["items"][0]["id"] == "R1" and body["signal_entity_ids"] == ["E1", "E2"]
    assert body["provenance"]["endpoint"] == "/v2/insights"
    assert rec.requests[0].url.params["signal.interests.entities"] == "E1,E2"


def test_recommendations_requires_signal_and_supported_type() -> None:
    client, rec = keyed_client(lambda r: httpx.Response(200, json=INSIGHTS_BODY))
    with client:
        no_signal = client.get(
            "/api/v1/qloo/insights/recommendations", params={"type": "urn:entity:movie"}
        )
        bad_type = client.get(
            "/api/v1/qloo/insights/recommendations",
            params={"type": "urn:entity:zzz", "entity_ids": "E1"},
        )
    assert (
        no_signal.status_code == 422
        and no_signal.json()["error"]["code"] == "qloo_rejected_request"
    )
    assert bad_type.status_code == 422
    assert rec.requests == []


def test_unexpected_exception_hides_internals() -> None:
    def boom(r: httpx.Request) -> httpx.Response:
        raise RuntimeError("secret internal detail /srv/app.py")

    client, _ = keyed_client(boom)
    with client:
        r = client.get("/api/v1/qloo/entities/search", params={"query": "x"})
    assert r.status_code == 500
    assert "secret internal detail" not in r.text and "Traceback" not in r.text
    assert r.json()["error"]["code"] == "internal_error"


def test_unknown_route_uses_error_envelope() -> None:
    client, _ = keyless_client()
    with client:
        r = client.get("/nope")
    assert r.status_code == 404 and r.json()["error"]["code"] == "not_found"


def test_cors_allows_only_configured_origins() -> None:
    app = create_app(make_settings(cors_origins="http://allowed.test"))
    with TestClient(app) as client:
        ok = client.get("/health", headers={"Origin": "http://allowed.test"})
        bad = client.get("/health", headers={"Origin": "http://evil.test"})
    assert ok.headers.get("access-control-allow-origin") == "http://allowed.test"
    assert "access-control-allow-origin" not in bad.headers


def test_request_id_header_roundtrip() -> None:
    client, _ = keyless_client()
    with client:
        r = client.get("/health", headers={"X-Request-ID": "abc123"})
    assert r.headers["X-Request-ID"] == "abc123"


def test_entity_types_endpoint() -> None:
    client, _ = keyless_client()
    with client:
        types = client.get("/api/v1/qloo/entity-types").json()["types"]
    assert "urn:entity:movie" in types and "urn:heatmap" not in types


def test_logs_never_contain_the_key(caplog: pytest.LogCaptureFixture) -> None:
    logger = logging.getLogger("redaction-test")
    handler = logging.StreamHandler()
    handler.addFilter(RedactionFilter([FAKE_KEY]))
    handler.setFormatter(JsonFormatter())
    records: list[str] = []
    handler.emit = lambda rec: records.append(handler.format(rec))  # type: ignore[method-assign]
    logger.addHandler(handler)
    logger.warning("header was X-Api-Key: %s", FAKE_KEY)
    logger.removeHandler(handler)
    assert records and FAKE_KEY not in records[0] and "[REDACTED]" in records[0]
