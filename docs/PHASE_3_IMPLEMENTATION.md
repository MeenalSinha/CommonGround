> **Update (Phase 4):** this report predates the audit. Its tests were *not* run when it was written; they were run in
> Phase 4 (3 test defects and 3 app defects were found and repaired) and persistence now exists. See
> [PHASE_4_PRE_UPGRADE_AUDIT.md](PHASE_4_PRE_UPGRADE_AUDIT.md) and [PHASE_4_IMPLEMENTATION.md](PHASE_4_IMPLEMENTATION.md).

# Phase 3 implementation: party, taste profiles, cultural discovery

**Status: implemented but UNVERIFIED.** Nothing was installed or run (see `PHASE_3_PRE_UPGRADE_AUDIT.md`).
No test counts are reported because no test ran. Expect type, lint, Prettier and test fixes on the first
`make check`.

## Routes
`/` home, `/status`, `/search` (Phase 2), plus `/party` (create or overview), `/member/[id]` (taste profile),
`/discover`. Providers in `_layout.tsx`: `BackendStatusProvider` then `PartyProvider`.

## Models (`state/party.ts`, pure and typed)
- `Party { id, name, members }`; `PartyMember { id, displayName, avatarColor, interests: Entity[],
  unresolvedInterests }`. Ids are generated at runtime; avatar colors are theme keys assigned by join order;
  avatars are initials badges, hidden from assistive tech.
- Resolved interests are the backend `Entity` objects unchanged (Qloo id preserved). Dedupe is by Qloo id.
- `UnresolvedInterest { id, text }` is separate, labelled "Not verified", and never reaches discovery.
- `DiscoveryRun` stores the request fingerprint, per-signal contributors and the full backend response
  (including provenance).
- Limits: names 40 characters, unresolved notes 60, member names unique case-insensitively (so people stay
  distinguishable). No participant cap. `MAX_SIGNAL_IDS = 20` mirrors the backend contract.

## State
React state in `PartyProvider` with a pure reducer, mirrored in a ref so rapid double presses see the first
result (a second Create is rejected). Survives navigation. **Not persisted: an app restart loses the party**
(no storage dependency exists; none was added). "Start over" resets it after confirmation. There is no
unsaved-form state to lose: edits commit on explicit Save, and back never discards committed data.
Results are cleared when a member is removed, an interest changes, or the category changes.

## Discovery workflow
1. Categories come from `GET /api/v1/qloo/entity-types` (no hardcoded list; error state if it fails).
2. The user picks one category and which interests to use (all selected by default).
3. `discoveryBlockers` blocks the request unless: a party exists, at least 2 people, at least 1 resolved
   interest, Qloo available (backend online and key configured), category loaded and supported, at least one and
   at most 20 selected interests. Over 20 is blocked with "Deselect N", never truncated.
4. Unique entity ids go to `GET /api/v1/qloo/insights/recommendations` (`type`, comma-joined `entity_ids`,
   `limit`). Duplicates across people are sent once; who chose what is kept locally.
5. Results show only returned fields (name, type, year, description, image if present). The header says the
   results come from Qloo and lists the interests and people used. Source details show provenance.
   No compatibility score, affinity or per-person fit is displayed or computed.
6. Results are shown only while their fingerprint matches the current selection; otherwise a "Selection changed"
   notice appears. A response arriving after the inputs changed is discarded.
7. Empty (HTTP 200, `empty: true`) and failure are separate states; failure offers a real retry.

## Backend
No backend change; existing endpoints satisfy Phase 3. `docs/API_CONTRACT.md` unchanged. The key stays backend-only.

## Keyless behavior
Party and profile management work offline. Search and discovery show an unavailable state with a Refresh action
that performs a real status request. A person can record unverified notes instead. No mock data in production.

## Tests written (not run)
`partyState.test.ts` (reducer, validation, signals, blockers), `PartyScreen`, `MemberScreen`, `DiscoveryScreen`
tests (mocked HTTP only), updated `HomeScreen` test. Mocked tests do not prove live Qloo behavior.
Not written: a single end-to-end test spanning all screens with a real router, and a live integration test.

## Known limitations
- Nothing executed: no Jest, ESLint, Prettier, `tsc`, Expo or backend tests. Formatting is hand-matched.
- No persistence; no simulator/device checks; narrow-screen and long-name behavior unverified visually.
- Button lacks an explicit focus ring. Nested `apps/mobile/.git` unresolved. Live Qloo pending (no key); the
  `/search` response shape and base URL remain documented assumptions.
- No negotiation or itinerary (Phase 4).

## Phase 4 readiness
Ready, once checks pass: typed party and profile model, entity ids with contributors, recommendation plumbing and
provenance. Blocked: verified build, live Qloo data, persistence decision.
