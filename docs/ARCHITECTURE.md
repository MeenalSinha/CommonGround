# Architecture

## Components

```
+---------------------------+        HTTPS/JSON        +--------------------------------------+       HTTPS       +-----------+
|  Mobile app (Expo, RN)    | -----------------------> |  Backend (FastAPI)                   | ----------------> |   Qloo    |
|  - theme / design tokens  |   EXPO_PUBLIC_API_       |  api/routes   thin HTTP handlers     |   X-Api-Key       |   API     |
|  - status + search UI     |   BASE_URL (public)      |  services     status, mapping        |   (backend only)  |           |
|  - services/apiClient     | <----------------------- |  integrations/qloo  client, parsers  | <---------------- |           |
+---------------------------+   one error envelope     |  core         config, errors, logs   |                   +-----------+
                                                       +--------------------------------------+
```

Responsibility boundaries:

| Layer | Owns | Must not |
|-------|------|----------|
| Mobile | UI, design system, accessibility, calling the backend | Hold secrets, call Qloo, invent results |
| `api/routes` | Parameter validation, HTTP mapping | Contain upstream request logic |
| `services` | Status tracking, mapping to public models, provenance | Parse upstream payloads |
| `integrations/qloo` | Auth header, URLs, retries, error classification, parsing | Leak upstream shapes upward |
| `core` | Env-driven settings, error types, JSON logging with redaction | Depend on routes |

## Data flow (implemented)

1. App opens, calls `GET /health` then `GET /api/v1/integrations/qloo/status` (no Qloo call).
2. User may press Verify, which calls `POST .../verify`. The backend makes one minimal search request and the
   status tracker records the real outcome.
3. User may search. `GET /api/v1/qloo/entities/search` becomes `GET /search` upstream. The user's text drives the request.
4. The upstream payload is parsed in `integrations/qloo/parsers.py` into normalized models, mapped to public models,
   and returned with provenance.

## Error flow

Upstream failure, then client classification (`QlooAuthError`, `QlooRateLimitedError`, `QlooTimeoutError`, ...), then
the status tracker records it, then a single exception handler returns the error envelope with a user-safe message and
a request id. Raw exceptions and tracebacks never reach the app; unexpected exceptions become `internal_error`.

## Keyless behavior

An absent or blank key becomes `None` in settings (never an empty header). The server starts, `/health` and `/ready`
work, status reports `not_configured`, and any Qloo-dependent route fails with 503 before any HTTP request is built.

## Configuration

Backend (`backend/.env`): `QLOO_API_KEY`, `QLOO_BASE_URL`, `BACKEND_PORT`, `CORS_ORIGINS`, `LOG_LEVEL`, plus
`QLOO_TIMEOUT_SECONDS`, `QLOO_MAX_RETRIES`, `QLOO_VERIFY_QUERY`. Mobile (`apps/mobile/.env`): `EXPO_PUBLIC_API_BASE_URL` only.
CORS is an explicit allow-list (empty by default); native apps do not use CORS.

## Why these choices suit the MVP

- Expo + TypeScript: one codebase for iOS and Android, fast iteration, strict typing.
- FastAPI + Pydantic: typed contracts, automatic validation, async HTTP for upstream calls.
- A dedicated integration package keeps Qloo's response format changes contained in one place.
- No database: Phase 0 and 1 hold no user data worth persisting. Group persistence arrives with group management.
- A deliberately small client: entity search and one Insights operation only.

## Deviations from the requested structure

- Expo Router routes live in `apps/mobile/src/app/` (not `apps/mobile/app/`), matching the Expo SDK 58 convention
  that keeps route files separate from non-route code.
- No empty placeholder directories were created. `api/` holds routes and dependencies; `schemas/` holds public models.

## Anticipated future flow (not implemented)

User interests, resolved to Qloo entities (Phase 1), feed Insights requests per participant. A later planning engine
will reconcile the returned entities, tags and provenance across a group with budget, location and exclusion
constraints. None of that engine exists yet; Phase 1 only supplies verified inputs and their provenance.
