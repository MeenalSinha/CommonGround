# CommonGround

Different tastes. One unforgettable adventure.

CommonGround is a mobile-first, agentic app that helps friends with different tastes find experiences they can all
enjoy, using Qloo's cultural intelligence to discover connections between interests. Built for the Qloo Agentic Hackathon.

## Status

| Item | Status |
|------|--------|
| Phase 0 (foundation) | Implemented. Backend checks re-run and passing (73 tests). |
| Phase 1 (Qloo integration) | **Implementation complete, pending live Qloo verification.** No API key has been issued, so no authenticated request has ever succeeded. |
| Phase 2 (mobile UI foundation) | Implemented and covered by Jest, lint, typecheck and an Android Metro bundle. **Not viewed on a device or simulator.** |
| Phase 3 (party, taste profiles, discovery) | Implemented; audited and repaired in Phase 4 ([audit](docs/PHASE_4_PRE_UPGRADE_AUDIT.md)). Discovery needs a Qloo key. |
| Phase 4 (negotiation engine, adaptive plan, local persistence) | **Implementation complete, pending live Qloo verification.** Verified with mocked HTTP only (170 mobile tests). Persistence verified through the AsyncStorage library mock, not on a device. See [Phase 4 report](docs/PHASE_4_IMPLEMENTATION.md). |
| Qloo API key | Not configured. The app runs honestly in keyless mode: no candidates, no plan. |
| Not built yet | Accounts, cloud sync, shared or multi-device voting, verified venue data (hours, prices, travel times), an LLM layer. |

## Stack

React Native + Expo SDK 58 + TypeScript (Expo Router) for mobile; Python 3.11+ with FastAPI, Pydantic and HTTPX for the backend.

## Repository structure

```
apps/mobile/   Expo app (src/app routes, components, theme tokens, services, hooks, tests)
backend/       FastAPI app (core, integrations/qloo, services, api/routes, schemas) and tests
docs/          Audit, requirements, architecture, API contract, Qloo setup, phase reports
```

## Prerequisites

Python 3.11+, Node 22+ and npm, and Expo Go or a simulator for running the app.

## Install and run

```bash
# Backend
cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"
cp .env.example .env          # leave QLOO_API_KEY blank for now
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# Mobile (second terminal)
cd apps/mobile && npm ci && cp .env.example .env
npx expo start
```

Set `EXPO_PUBLIC_API_BASE_URL` in `apps/mobile/.env` for your target: `http://localhost:8000` (iOS simulator, web),
`http://10.0.2.2:8000` (Android emulator), or `http://<LAN-IP>:8000` (physical device). `make` targets wrap the same commands.

## Tests and checks

```bash
cd backend && pytest && ruff check . && ruff format --check . && mypy
cd apps/mobile && npm run check          # typecheck, lint, format, Jest
cd backend && pytest -m live -q -rs      # optional live test; SKIPPED without a key
```

## Keyless workflow

Without `QLOO_API_KEY` the backend starts, `/health` works, status reports `not_configured`, and Qloo routes return
503 `qloo_not_configured` without making any upstream request. The app shows connection status (home summary and `/status`), disables search and verification, explains why, and shows no results. Nothing is mocked in production code.

## Connecting Qloo when the key arrives

Add it to `backend/.env` only, restart, run `python -m app.cli verify`, then `pytest -m live`. Full steps and
the official key-acquisition link are in [docs/QLOO_SETUP.md](docs/QLOO_SETUP.md). Never commit or paste the key.

## Current limitations

- Live Qloo behavior is unverified; the `/search` response shape and the hackathon base URL are assumptions listed in
  [docs/API_CONTRACT.md](docs/API_CONTRACT.md) section 3.
- Nothing has been run on a device or simulator; screens were never viewed. The CI workflow has not been executed.
- Plans and parties are saved on this device only (AsyncStorage, unencrypted). Restart durability is verified through a
  library mock, not on hardware.
- Ranking weights are untuned heuristics; Qloo's response ordering semantics are unverified. See the
  [Phase 4 report](docs/PHASE_4_IMPLEMENTATION.md) section 14.
- The former nested `apps/mobile/.git` (no commits) was moved to `.maintenance/` (git-ignored); the repo root is now one git repository.
- Starlette's test client prints a deprecation warning about `httpx`; harmless for now.

## Documentation

[Audit](docs/PROJECT_AUDIT.md), [Requirements](docs/PRODUCT_REQUIREMENTS.md), [Architecture](docs/ARCHITECTURE.md),
[API contract](docs/API_CONTRACT.md), [Qloo setup](docs/QLOO_SETUP.md), [Phase 0 report](docs/PHASE_0_REPORT.md),
[Phase 1 report](docs/PHASE_1_REPORT.md), [Phase 2 audit](docs/PHASE_2_PRE_UPGRADE_AUDIT.md), [Phase 2 implementation](docs/PHASE_2_IMPLEMENTATION.md), [Phase 3 audit](docs/PHASE_3_PRE_UPGRADE_AUDIT.md), [Phase 3 implementation](docs/PHASE_3_IMPLEMENTATION.md), [Phase 4 audit](docs/PHASE_4_PRE_UPGRADE_AUDIT.md), [Phase 4 implementation](docs/PHASE_4_IMPLEMENTATION.md). Fonts (Fredoka, Nunito) come from `@expo-google-fonts` under OFL-1.1.
