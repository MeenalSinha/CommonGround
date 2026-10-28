# Phase 3 pre-upgrade audit

Method: static re-read of the Phase 2 code and the backend, plus `python -m compileall` on the backend.
**Dependencies still could not be installed** (no network: `npm ping` and `pip download` both fail; no
`node_modules`, no `.venv`). So **no test, linter, type checker, formatter or Expo start was executed in this
session either.** Nothing below is marked PASS on the strength of a run.

## Phase 2 report findings, re-checked against the checkout

| Finding | Status | Notes |
|---------|--------|-------|
| Phase 2 implemented but unverified | CONFIRMED | Still unverified; `make check` has never been run on Phase 2 code. |
| Nested git repo `apps/mobile/.git` | CONFIRMED, NOT FIXED | No commits; its index holds a stale `create-expo-app` scaffold (staged files that no longer exist in the worktree). No repo at the monorepo root. Not deleted (preserve metadata). Safest fix for the owner: back it up (`mv apps/mobile/.git ~/mobile-git-backup`), then `git init` at the root and commit. |
| Backend untouched since Phase 1 | PASS (static) | Routes `/api/v1/qloo/entity-types`, `/entities/search`, `/insights/recommendations` exist with the contract the mobile client now uses. |

## Phase 2 checklist

| Area | Status | Evidence |
|------|--------|----------|
| Tokens centralized, no duplicate theme files | PASS (static) | `theme/` only. |
| Buttons: pressed/disabled/focus | PARTIAL | Pressed and disabled implemented; Button has no focus ring (keyboard/web focus relies on platform default). Not changed. |
| Interactive vs inert cards | PASS (static) | `Card` is a button only with `onPress`. |
| Consistent loading/empty/unavailable/error/success | PASS (static) | `StateMessage`. |
| Contrast, touch targets, labels | PASS (static, hand-computed) | Not measured with a tool. |
| Reduced motion | PASS (static) | Gated in `LoadingBlob`, `AvatarCluster`. |
| Home: identity, nav, no fabricated data | PASS (static) | Tests exist but were not run. |
| Navigation / single status provider | PASS (static) | One `BackendStatusProvider` in `_layout`. |
| Status and search truthfulness | PASS (static) | Verified only when backend state is `ready`. |
| Duplicate component | NOTE | `EntitySearch` (developer check on `/search`) has its own input styling separate from the new `TextField`. Left as is. |
| `make check`, `make test-mobile`, `make test-backend` | NOT TESTED | Environment cannot install dependencies. |
| Keyless flow | PASS (static) | No request is made without a key; status is `not_configured`. |
| Live Qloo | BLOCKED EXTERNALLY | No key. Remains pending. |

## Defects found / repairs
No new Phase 2 defect was found by reading, so no repair was made. The unverified state is itself the risk.

## Decision
**Conditional GO**, on static evidence only. The brief's gate (checks run before building) could not be met.
Phase 3 code was written without execution and must be checked with
`make install && make check` before it is trusted.
Phase 1 remains: implementation complete, pending live Qloo verification.
