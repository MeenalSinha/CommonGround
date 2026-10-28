# Phase 4 pre-upgrade audit (Phase 3 verification)

Date of audit: 2026-10-28. Unlike the Phase 2 and Phase 3 audits, **dependencies installed this time and
every check below was actually executed.** Statuses: PASS (verified by a run or a test that exercises it),
FAIL (defect found; see "Repairs"), PARTIAL, BLOCKED EXTERNALLY, NOT TESTED.
"PASS (test)" means an automated test exercises the behavior. "PASS (run)" means I ran it for real.

## 1. What was executed, and the results

Environment: Node 22.22.2, npm 10.9.7, Python 3.12.3 (project asks for 3.11+). `npm ci` and
`pip install -e ".[dev]"` both succeeded.

| Command | Before repairs | After repairs |
|---------|----------------|---------------|
| backend `pytest` | 73 passed, 1 deselected (the live test, needs a key) | unchanged: 73 passed, 1 deselected |
| backend `ruff check` / `ruff format --check` / `mypy` | clean / 34 files formatted / no issues in 25 files | unchanged |
| mobile `npm run typecheck` (`tsc --noEmit`) | clean | clean |
| mobile `npm run lint` (`--max-warnings=0`) | **1 error** (`react/no-unescaped-entities`, HomeScreen) | clean |
| mobile `npm run format:check` | **7 files** not Prettier-formatted | clean |
| mobile Jest | **58 passed, 3 failed** (61 total); "Jest did not exit" warning | **66 passed, 0 failed** (66 total); no open-handle warning |
| `expo export --platform android` (Metro + Expo Router bundle) | not run | succeeded (Hermes bundle, 2.6 MB) |
| Backend started with `uvicorn`, real HTTP calls, no key | not run | see section 3.5 |

Not run: any simulator, emulator or physical device; `expo start` interactively; the GitHub Actions workflow;
`pytest -m live` (no key, so it would only skip, and a skip is not a verification).

## 2. Defects found and repaired

| # | Defect | Kind | Repair |
|---|--------|------|--------|
| D1 | `HomeScreen` used a raw `'` in JSX text (lint error) | code | Escaped (`&apos;`). |
| D2 | 7 files not Prettier-formatted (Phase 3 was hand-formatted) | code | `prettier --write`. |
| D3 | `PartyScreen` test used `getByText(/1 interest/)`, which legitimately matches both the header ("2 people · 1 interest") and Ann's card | test | Asserted the header line and the single card label separately. The UI was correct. |
| D4 | `HomeScreen` rerender test failed: `renderWithStatus` wrapped providers around `ui`, so `rerender(<HomeScreen/>)` dropped them | test harness | Providers now supplied through RNTL's `wrapper`, which `rerender` keeps. |
| D5 | `SearchScreen` "loading then empty" test deadlocked for 5 s. Diagnosed by isolating it: `await fireEvent.press()` (RNTL v14, async) waits for the app to settle, which cannot happen while the test deliberately holds the request open. The app code was correct. | test | Press started inside `act`, awaited after the request is released. |
| D6 | **Reducer accepted `discovery/run` unconditionally.** The screen guarded late responses, but the reducer would store a run for a category that was no longer selected, or built from an interest that had since been removed. | **app** | New `runIsCurrent`: the run must match the current category and every signal must still exist with the same contributors. 5 regression tests. One pre-existing test never selected a category before recording a run; it now does. |
| D7 | **`SignalSnapshot.memberNames` stored names, not ids.** After renaming a person, the "Based on ..." line showed the old name. | **app** | Snapshot now stores `memberIds`; names are resolved live with `memberNamesFor`. Regression test. |
| D8 | `Button` had no focus indicator (known Phase 2 PARTIAL) | **app** | Focus state with the existing `focus` token and `focusBorderWidth`. Not testable on a device here; unit tests pass. |
| D9 | **Nested `apps/mobile/.git`** (see 1.7 for the full analysis). It blocked `git add` at the monorepo root. | repo | Moved (not deleted) to `.maintenance/nested-mobile-git.bak` (git-ignored); root repo initialised with a baseline commit of Phase 3 as received. |

Backend: no defect found and no backend change was needed.

## 3. Checklists

### 3.1 State architecture (`state/party.ts`, `PartyContext.tsx`, `types/api.ts`)

| Item | Status | Evidence |
|------|--------|----------|
| Party data is typed | PASS (run) | `tsc` clean; `Party`, `PartyMember`, `UnresolvedInterest`, `DiscoveryRun`, `PartyState`. |
| Ids generated dynamically | PASS (test) | `makeId` (time + random + counter); only test fixtures use fixed ids. |
| Names validated | PASS (test) | trim, collapse whitespace, empty, over 40 characters. |
| Duplicate names handled | PASS (test) | case-insensitive rejection. |
| Add / edit / remove participants | PASS (test) | reducer and screen tests. |
| Interests are genuine backend entities | PASS (test) | picker test adds a mocked-backend result with its Qloo id. |
| Qloo ids preserved | PASS (test) | |
| Duplicate interests prevented | PASS (test) | per member, by Qloo id. |
| Unresolved kept separate; never sent as ids | PASS (test) | `never counts unresolved text as a signal`. |
| Removing people or interests invalidates results | PASS (test) | |
| Category change invalidates results | PASS (test) | |
| Late responses cannot overwrite newer state | **FAIL, repaired (D6)** | Screen-level guard worked; reducer-level did not. Now PASS (test). |
| Fingerprints represent the inputs | PASS after D6 | The fingerprint is category + sorted entity ids; contributors are now also checked by `runIsCurrent`. |
| Selectors keep who contributed each entity | PASS (test); names **FAIL, repaired (D7)** | |
| Rapid repeated submissions | PASS (test) | double press on Create makes one party (ref mirror of state). |
| Edge cases | PARTIAL | Covered: empty party, one person, removal, duplicates. Not covered: very large parties, extremely long entity names. |
| Persistence | **CONFIRMED: none.** No storage dependency in `package.json`. | Phase 4 resolves this (see `PHASE_4_IMPLEMENTATION.md`). |

### 3.2 Party creation and participants

| Item | Status | Evidence |
|------|--------|----------|
| Create / rename party | PASS (test) | |
| Create / edit / remove participant | PASS (test) | removal needs a second confirm press. |
| Invalid names give clear feedback | PASS (test) | |
| Profile shows actual interests | PASS (test) | |
| Editing keeps Qloo ids | PASS (test) | |
| Reopening a profile does not duplicate | PASS (test) | duplicate add is blocked. |
| Removed participant leaves discovery inputs | PASS (test) | `excludes removed participants from signals`. |
| No fabricated users or sample groups | PASS (test) + grep | starts empty. |
| Navigation preserves group state | PARTIAL | Provider sits above the `Stack` in `_layout.tsx` and the bundle builds; no test drives the real router or a device. |

### 3.3 Cultural discovery

| Item | Status | Evidence |
|------|--------|----------|
| Categories come from the backend | PASS (test) | no `urn:entity:` literal in production mobile code (grep). |
| Search and recommendations use the one API client | PASS (test) | |
| Only resolved ids are signals; duplicates sent once | PASS (test) | |
| Max 20 respected; no silent truncation | PASS (test) | blocked with "Deselect N". Also enforced by the backend (422, run). |
| User chooses which interests contribute | PASS (test) | toggles; selection is screen-local state (lost on leaving the screen; Phase 4 stores selection in the session). |
| Contributors recorded | PASS (test) | |
| Fields rendered; provenance preserved | PASS (test) | |
| Empty vs failure distinct; retry is a real request | PASS (test) | |
| Unavailable states accurate | PASS (test) | |
| Late response cannot overwrite; stale results hidden | PASS (test) | |
| No fake scores | PASS (grep + test) | |

### 3.4 Navigation and visual experience

| Item | Status | Evidence |
|------|--------|----------|
| Router initialises; routes work | PARTIAL | Android bundle exports with all routes (run). No runtime or device check. |
| Back navigation | NOT TESTED | needs a device or router test. |
| Provider scoping | PASS (code + bundle) | `BackendStatusProvider` then `PartyProvider` above the `Stack`. |
| Cohesive visual identity; centralised tokens | PASS (code) | `theme/` only. Not viewed on a screen. |
| Interaction states | PASS (test) for pressed/disabled/busy; focus **repaired (D8)** | |
| Narrow-screen layout | NOT TESTED | no device or screenshot tooling. |
| Accessibility labels and roles | PASS (test) | roles asserted in tests. Not audited with a screen reader. |
| Touch targets | PASS (code) | `sizes.touchTarget = 48`. |
| Reduced motion | PASS (test, mocked) | `LoadingBlob`, `AvatarCluster` stop; animation path itself is not asserted. |
| Consistent loading/empty/error/unavailable | PASS (code) | one `StateMessage` component. |
| No dead controls | PASS (code review) | Home still says "Planning: coming soon", updated in Phase 4. |

### 3.5 Phase 1 and backend stability

All of the following were **run** against a live `uvicorn` with no key (not just read):

| Item | Status | Evidence |
|------|--------|----------|
| Backend starts | PASS (run) | |
| Health endpoints | PASS (run) | `/health` 200; `/ready` 200 with `qloo_configured: false`. |
| Key read from backend config only | PASS (code) | `Settings.qloo_key_value()` is the single exposure point. |
| Key absent from mobile code | PASS (grep) | only the *name* `QLOO_API_KEY` appears, in help text. |
| Missing key prevents upstream requests | PASS (run) | search and recommendations return 503 `qloo_not_configured`; status `not_configured`. |
| Validation | PASS (run) | no signal gives 422; 21 ids gives 422. |
| Consistent error envelope | PASS (run) | |
| Provenance preserved | PASS (test) | |
| Rate limits and timeouts | PASS (test, mocked) | 429 surfaced with Retry-After; timeouts retried. Not exercised against real Qloo. |
| Logs free of secrets | PASS (test) | existing backend tests assert the key is absent from logs. |
| No fabricated results when unavailable | PASS (run) | |
| Authenticated behavior | **BLOCKED EXTERNALLY** | no key. |

### 3.6 Tests

See section 1. Nothing skipped or weakened. The one deselected backend test is the live Qloo test, which
needs a key.

### 3.7 Repository hygiene (nested Git)

`apps/mobile/.git` still existed. Findings: branch `master` with **no commits**; the index held 7 staged files
and 4 staged-then-deleted files from a stale `create-expo-app` scaffold; no repository existed at the monorepo
root. It caused a real problem: `git add -A` at the root failed with
`'apps/mobile/' does not have a commit checked out`. There was no history to preserve. Action taken: `mv` of the
whole directory to `.maintenance/nested-mobile-git.bak` (listed in `.gitignore`; restorable by moving it
back), `git init -b main` at the root, and a baseline commit of Phase 3 exactly as received, so all audit
repairs are visible as later diffs. The root repo tracks 127 files and no `.env`, `node_modules` or `.venv`.

## 4. Remaining external limitations

- **Qloo key not issued.** No authenticated request has ever succeeded. The `/search` response shape and the
  hackathon base URL remain documented assumptions (`API_CONTRACT.md` section 3).
- **No device or simulator.** Layout, safe areas, gestures, real reduced-motion settings, and the native
  storage behavior of AsyncStorage across a real app restart cannot be verified in this environment.
- `npm audit` reports 16 vulnerabilities (13 low, 3 high) in the dependency tree. Not triaged; recorded only.

## 5. Status summaries

- **Qloo integration:** implementation complete, **pending live verification**.
- **Persistence:** none in Phase 3 (confirmed). To be added in Phase 4.

## 6. Decision

**GO.** All fixable Phase 3 defects (D1 to D9) are repaired and re-verified (backend 73/73, mobile 66/66,
typecheck, lint, format all clean; Android bundle builds). The only open items are external (key, device).
Phase 4 development proceeds with the portions that can be implemented and tested honestly.
