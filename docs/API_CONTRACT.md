# API Contract

Three sections, kept deliberately separate:

1. Verified facts from official Qloo sources
2. CommonGround application abstractions (this backend's own public API)
3. Unverified items (no credentials were available)

## 1. Verified facts (official Qloo documentation)

Source: the public `qloo/docs-public` repository, whose markdown files mirror docs.qloo.com
(`reference/api-onboarding.md`, `api-overview.md`, `get-search.md`, `basic-insights-use-case.md`,
`insights-api-deep-dive.md`, `parameters.md`, `available-parameters-by-entity-type.md`).

| Topic | Verified fact |
|-------|---------------|
| Authentication | API key sent in the `X-Api-Key` request header. |
| Entity search | `GET /search`. Documented parameters: `query`, `types` (array of strings), `take` (1 to 100, default 20), `page` (1 to 100, default 1), `sort_by` (`match`, `distance`, `popularity`) and several `filter.*` options. Documented responses: 200 OK, 404 No results, 429 Rate limit exceeded. |
| Insights | `GET /v2/insights`. Required: `filter.type` plus at least one filter or signal. Signals used here: `signal.interests.entities` and `signal.interests.tags` (comma-separated ids). Output: `take`, `offset`. |
| Insights response | `{"success": true, "results": {"entities": [{"name", "entity_id", "type", "subtype", "properties", "popularity", "tags"}]}, "duration": <int>}` |
| Entity types (`filter.type`) | `urn:entity:artist`, `book`, `brand`, `destination`, `movie`, `person`, `place`, `podcast`, `tv_show`, `videogame`. (`urn:heatmap` is listed but is not an entity type and is excluded.) |
| Per-type requirement | `signal.interests.entities` is required for `urn:entity:destination` (per the entity-type parameter guide). |
| Base URLs seen in official docs | `https://api.qloo.com` (docs examples) and `https://staging.api.qloo.com` (onboarding examples). |
| API key acquisition | Official onboarding says to contact Qloo for a key; the hackathon developer guide at https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide describes how hackathon keys are requested. |

Important finding: the file named `openapi-schema.json` in `qloo/docs-public` (fetched 2026-10-28) is the generic
OpenAPI 3.1 meta-schema (`$id: https://spec.openapis.org/...`), not a Qloo-specific specification. It contains no
`paths`. The endpoint facts above therefore come from the reference markdown pages instead.

## 2. CommonGround backend contract (application level)

Base URL: the backend (default `http://localhost:8000`). All errors use one envelope:

```json
{ "error": { "code": "qloo_not_configured", "message": "...", "request_id": "...", "details": {} } }
```

| Method and path | Purpose | Calls Qloo? |
|-----------------|---------|-------------|
| `GET /health` | Liveness | No |
| `GET /ready` | Readiness plus whether a key is configured (a missing key is not a failure) | No |
| `GET /api/v1/integrations/qloo/status` | Evidence-based integration status | No |
| `POST /api/v1/integrations/qloo/verify` | One explicit, minimal live request | Yes (503 if no key) |
| `GET /api/v1/qloo/entity-types` | Verified entity type list | No |
| `GET /api/v1/qloo/entities/search` | Entity resolution. Query: `query` (1 to 100 chars, required), `types` (repeat or comma-separate), `limit` (1 to 50, default 10), `page` (1 to 100) | Yes |
| `GET /api/v1/qloo/insights/recommendations` | Insights. Query: `type` (required), `entity_ids`, `tag_ids` (at least one signal; max 20 each), `limit` (1 to 50), `offset` (0 to 1000) | Yes |

Search and recommendation responses contain `items`, `count`, `empty`, paging fields and a `provenance` object
(`source`, `endpoint`, `retrieved_at`, `upstream_duration_ms`, non-secret `parameters`). An empty result is HTTP 200
with `empty: true`, distinct from any error. Fields Qloo does not return are `null` or empty, never invented.

Integration status states:

| State | Meaning |
|-------|---------|
| `not_configured` | No key. No upstream request is attempted. |
| `pending_verification` | Key present, no successful live request yet. |
| `ready` | At least one genuine successful upstream (HTTP 200) response was observed. |
| `auth_failed` | Qloo answered 401 or 403. |
| `rate_limited` | Qloo answered 429. |
| `unavailable` | Timeout, network failure, 502/503/504 or an unparseable response. |

Error codes: `qloo_not_configured` (503), `qloo_auth_failed` (502), `qloo_rate_limited` (429, `Retry-After`
passed through), `qloo_timeout` (504), `qloo_unreachable` (502), `qloo_upstream_error` (502),
`qloo_invalid_response` (502), `qloo_rejected_request` (422), `validation_error` (422), `not_found` (404),
`internal_error` (500).

Application-level choices (not Qloo facts): the 50-item limit on `limit`, the 20-id cap, the status state machine,
the provenance object, and retry policy (below).

Retry policy: network errors, timeouts and HTTP 502/503/504 are retried up to `QLOO_MAX_RETRIES` (default 2) with
exponential backoff and jitter. 401, 403, 429, 400 and 500 are never retried. A 429 is surfaced immediately with its
`Retry-After` header because no retry behavior is documented.

## 3. Unverified (requires a real key)

- Whether the default `QLOO_BASE_URL` of `https://hackathon.api.qloo.com` is correct for your key. It appears in
  third-party hackathon projects, not in a source this build could read directly. Confirm against the instructions
  delivered with your key.
- The exact JSON shape of `GET /search` responses. The official reference page publishes no response example. The
  parser accepts `results` as a list or `results.entities` and the same entity keys as Insights, and raises
  `qloo_invalid_response` for anything else.
- How `types` must be encoded on `/search` (comma-separated is used; repeated parameters are untested).
- Whether the hackathon tier restricts any entity types, parameters or rate limits. No numeric rate limit was found.
- Whether a 404 on `/v2/insights` can mean "no results". It is documented only for `/search`, so Insights 404 is
  treated as an upstream error.
- Authenticated behavior of every route above. No authenticated request has been made.
