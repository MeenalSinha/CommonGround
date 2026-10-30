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

## Group negotiation and planning (Phase 4, implemented)

The mobile app owns negotiation; the backend is unchanged. `PartyState` holds the party, category and a
`NegotiationSession`. `state/store.ts` routes party actions through the Phase 3 reducer and then reconciles the session
(so edits, removals and category changes invalidate stale evidence); negotiation and plan actions go to
`state/negotiation/reducer.ts`.

```
interests -> queries (per person + group) -> orchestrator (sequential, existing integrationApi.recommendations)
          -> query records (status, order, provenance) -> candidate pool (dedupe by Qloo id)
          -> rank fusion + explicit feedback, hard constraints as filters -> planner -> plan
          -> validation / status -> explicit finalize
```

Engine modules are pure (no React, no network); the orchestrator is the only part that calls the network, through the
existing client. Local persistence (`state/persistence.ts`) is a versioned, validated, ordered-write layer over a
`SessionStorage` interface (AsyncStorage implementation). It is on-device only, with no backend database or sync.
Details, the ranking method and limits: [PHASE_4_IMPLEMENTATION.md](PHASE_4_IMPLEMENTATION.md).

## Production & Multi-Platform Architecture (Phase 5)

Phase 5 hardens CommonGround for production, security, multi-platform client delivery, and automated release verification:

1. **Multi-Platform Client Delivery:**
   - **Native Android & iOS:** Expo 58 with EAS Build profiles (`eas.json`) producing native Android packages (`dist/` bundles).
   - **Browser-Accessible Web Demo:** Built with React Native for Web (`react-native-web ~0.21.0`), producing static Single-Page Application assets (`apps/mobile/dist/`) compatible with Vercel, Netlify, and Cloudflare Pages.
   - **Environment Strictness:** In production builds, `resolveApiBaseUrl` rejects missing backend URLs or localhost fallbacks, preventing misconfigured release bundles.
2. **Containerized Backend:**
   - Packaged in a lightweight Debian container (`python:3.11-slim`) executed by an unprivileged system user (`appuser:appgroup`, UID 1001).
   - Embedded Docker health checks monitor `/health`.
   - Strict CORS policy dynamically restricts browser origin access via `CORS_ORIGINS`.
3. **Local Privacy Controls:**
   - A dedicated `PrivacyPanel` on the `/status` screen explicitly outlines local-only data retention, absence of user tracking, and provides a confirmed "Clear all local data" wipe action.
4. **Plan Title Auto-Synchronization:**
   - The root state reducer (`apps/mobile/src/state/store.ts`) synchronizes default plan titles automatically when a party is renamed, while preserving any custom title provided by the user.

## Not implemented

Accounts, cloud or multi-device sync, shared voting, verified venue data (hours, prices, travel times), and any LLM
layer. If an LLM is added later it must stay server-side, receive only real candidates, and have its output validated by
the deterministic planner, which already enforces the hard constraints.
