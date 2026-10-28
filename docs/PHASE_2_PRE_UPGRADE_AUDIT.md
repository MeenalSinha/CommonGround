# Phase 2 pre-upgrade audit

Method: static inspection of the uploaded checkout (all mobile source, tests and config; the backend
core, client, service, routes, schemas and config) plus byte-compilation of the backend. **No
dependency could be installed** (the sandbox has no network; neither `backend/.venv` nor
`apps/mobile/node_modules` exists), so **no test, linter, type checker or app start was executed**.
Historical counts (73 backend / 12 mobile tests) are not re-verified.

Status key: PASS, FAIL, PARTIAL, BLOCKED EXTERNALLY, NOT TESTED.

## Phase 0

| Item | Status | Evidence |
|------|--------|----------|
| Repository inspected | PASS | Full tree read. |
| Frontend/backend boundaries | PASS | `apps/mobile` only talks to the backend over HTTP; Qloo is reached only from `backend/`. |
| Expo app starts | BLOCKED EXTERNALLY | No `node_modules`, no network. |
| FastAPI app starts | BLOCKED EXTERNALLY | No installed dependencies. Backend files byte-compile (`compileall`). |
| Lockfiles consistent | NOT TESTED | `npm ci` / `pip install` not possible. |
| README setup accurate | PARTIAL | Commands match Makefile and package scripts by reading; not executed. |
| Theme tokens centralized | PASS | `theme/tokens.ts`, `typography.ts`; components import from `@/theme`. |
| Loading/empty/error/disabled handled | PARTIAL | Present, but each component styled them ad hoc (fixed by `StateMessage`). |
| Touch targets / a11y labels | PASS | 48pt controls; roles and labels present. |
| Reduced motion | PASS (static) | `useReducedMotion` gates `LoadingBlob`; behavior not run on a device. |
| No secrets in mobile | PASS | Search of `apps/mobile/src` found only `EXPO_PUBLIC_API_BASE_URL`; the only `QLOO_API_KEY` mention is help text. |
| No fabricated cultural data | PASS | `AvatarCluster` is decorative and hidden from assistive tech. |
| Nested git repo | FAIL (not fixed) | `apps/mobile/.git` exists with no commits; the monorepo root has no `.git`. Looks like a `create-expo-app` leftover. Left untouched because removing it is destructive; the owner should delete it or `git init` at the root. |
| Backend config/errors/logging | PASS (static) | Blank key becomes `None`; the key is only exposed through `qloo_key_value()` for the header; logs record path, reason and attempt only. |

## Phase 1

| Item | Status | Evidence |
|------|--------|----------|
| Credentials from backend config only | PASS | `client._get` reads `settings.qloo_key_value()`. |
| No upstream request without a key | PASS (static) | `_get` raises `QlooNotConfiguredError` before any HTTP call. |
| Search and one Insights operation | PASS (static) | `search_entities`, `get_insights`. |
| Input validation, 404 empty vs failure, timeouts, auth/rate-limit/5xx, bounded retries | PASS (static) | `client.py`; retries capped by `qloo_max_retries` (<= 5), 502/503/504 only. |
| Provenance preserved | PASS | `Provenance` on every response. |
| Mobile type vs backend `Provenance` | PARTIAL | Mobile `Provenance` omits the backend's `parameters` field. Harmless (unused), left as is. |
| Backend and mobile tests pass | NOT TESTED | Cannot run. |
| `make check`, `make test-backend`, `make test-mobile` | NOT TESTED | Cannot run. |
| `make live-test` | NOT TESTED | Would be skipped without a key; a skip is not a verification. |
| Live Qloo behavior | BLOCKED EXTERNALLY | No API key. Base URL, `/search` shape and parameter encoding remain the documented assumptions in `API_CONTRACT.md` section 3. |

## Phase 0/1 defects found in the app code

1. Home screen showed a developer-facing "Phase 0 and 1" card and the full diagnostics panel inline.
2. Each component rendered its own loading/empty/error/unavailable styling.
3. `interaction.disabledOpacity` token was unreferenced (removed).
4. Coral `#D6432E` with white button text is about 4.4:1 by hand calculation, below comfortable AA; changed to `#C73A25` (about 5.2:1, computed by hand, not measured with a tool).

No backend defects were found by reading, so no backend changes were made.

## Go / no-go

**Conditional GO.** No unresolved implementation defect was found by inspection, and Phase 1 stays marked
**implementation complete, pending live Qloo verification**. The stricter gate in the brief (tests green
before upgrading) **could not be met**. Phase 2 work therefore proceeded on static evidence only, and
every Phase 2 change is unverified until the checks below pass on a machine with dependencies:

```
make install && make check && make test-mobile && make test-backend
```
