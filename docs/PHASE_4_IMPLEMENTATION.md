# Phase 4 implementation: group negotiation engine and adaptive shared plan

**Phase 4 implementation: COMPLETE, PENDING LIVE QLOO VERIFICATION.**
No Qloo API key exists, so no authenticated request has ever succeeded. Everything below was verified against
mocked HTTP, never against live Qloo. "Persistence" was verified through the AsyncStorage library's official Jest
mock, not on a device.

## 1. Phase 3 pre-upgrade audit (summary)

Full detail: [PHASE_4_PRE_UPGRADE_AUDIT.md](PHASE_4_PRE_UPGRADE_AUDIT.md). For the first time in this project the
checks were actually run. Baseline: backend 73/73; mobile typecheck clean, lint 1 error, 7 files unformatted, Jest
**58 pass / 3 fail**. After repairs: Jest 66/66, everything clean.

## 2. Defects found and repaired (D1 to D9)

| # | Defect | Kind |
|---|--------|------|
| D1, D2 | Lint error; 7 unformatted files | code |
| D3, D4, D5 | Three failing Phase 3 tests: ambiguous text query; `rerender` dropped providers; held-open request deadlocked RNTL's async `fireEvent` | test (app was correct) |
| D6 | Reducer accepted any `discovery/run`, so a late response could be stored for a stale category or removed interest | **app** |
| D7 | Run snapshots stored contributor *names*, so a rename left stale names | **app** |
| D8 | `Button` had no focus indicator | **app** |
| D9 | Nested `apps/mobile/.git` with zero commits blocked `git add` at the root | repo (backed up to `.maintenance/`, root repo initialised) |

Two further defects were found during Phase 4 work and fixed: the same render-time-mutation lint error in two test
harnesses, and redundant provider state updates on every successful save.

## 3. Architecture

One source of truth. `PartyState` (Phase 3) gained a `negotiation: NegotiationSession | null` field.

```
state/party.ts                 party reducer (unchanged API; stricter discovery/run)
state/store.ts                 rootReducer: party actions -> reconcile session; negotiation/plan actions -> negotiation reducer
state/negotiation/config.ts    EVERY tunable number and mapping, each with its rationale
state/negotiation/types.ts     NegotiationSession, QueryRecord, NegotiationCandidate, ParticipantFeedback, ExperiencePlan ...
state/negotiation/queries.ts   which requests the current inputs call for (per person + group), 20-id rule, dedupe
state/negotiation/pool.ts      merge by Qloo id, derived provenance, eligibility, reconcileSession (invalidation)
state/negotiation/ranking.ts   rank fusion + feedback; hard constraints as filters
state/negotiation/planner.ts   selection, generate / alternative / replace / add / remove / move
state/negotiation/validation.ts status, issues, ready / acknowledge / finalize / reopen
state/negotiation/explain.ts   sentences built from evidence only
state/negotiation/orchestrator.ts  the agent's retrieval loop (sequential requests, retry, stop rules)
state/negotiation/reducer.ts   all negotiation and plan actions, late-response guard, read-only when finalized
state/negotiation/view.ts      pure view-model for the screens
state/persistence.ts           storage interface, versioned envelope, strict validation, ordered write queue
state/asyncStorageAdapter.ts   AsyncStorage implementation of the storage interface
screens/NegotiateScreen.tsx, PlanScreen.tsx; components/CandidateCard, PlanStepCard, ChoiceChip
```

The engine modules contain no React and no network code. The only network call is `integrationApi.recommendations`,
the existing Phase 3 client, invoked from the orchestrator. **No backend change was needed**; the API contract is
unchanged.

## 4. Candidate generation

- One recommendation query per participant with at least one resolved interest, plus one group-level query when at
  least two participants contribute. Both thresholds are in `config.ts`.
- Requests use real Qloo ids only. Unresolved free-text interests are never sent.
- The 20-id limit is never applied by truncation. An over-limit selection is shown as "Deselect N for X" and blocks
  gathering until the organizer chooses which interests to keep (per query, in the "Interests used" card).
- A participant with no resolved interests is listed as **not represented**; no one else's interests are borrowed.
- Requests run **one at a time**, spaced by `discovery.requestSpacingMs`. Queries with identical signals share one
  HTTP request (each query still keeps its own provenance record).
- Default gather requests only what is missing or failed, so retrying never duplicates calls or candidates.
  "Refresh everything" re-requests deliberately.
- After `qloo_rate_limited`, `qloo_not_configured`, `qloo_auth_failed`, `qloo_unreachable`, `backend_unreachable` or
  `backend_timeout`, the remaining requests are **not sent** and are recorded as `not_run`. A single
  `qloo_timeout` or upstream error does not stop the run.
- A failed query is `failed`, a query Qloo answered with nothing is `empty`, and a skipped one is `not_run`. The
  three are different states in data and in the UI.
- A partial failure keeps the successful candidates and says which people are not represented equally.

## 5. Recommendation provenance

Provenance lives once, in the per-query records (`QueryRecord`: kind, member, exact ids sent, status, error, result
order, retrieval time, backend `provenance`). A candidate's sources are **derived** from those records, so evidence
cannot drift out of sync. Candidates are deduplicated by Qloo entity id; re-applying a query replaces its record and
drops candidates nothing surfaces any more.

Evidence kinds stay separate: surfaced by a person's query, surfaced by the group query, added by hand from a Qloo
search, and explicit feedback. Wording is "Surfaced from Ann's selected interests", never "Ann loves this". "Position"
is the 1-based order of the backend response (always offset 0).

## 6. Ranking and constraints

Computed in `ranking.ts`; not a Qloo score and never displayed as a number.

1. **Evidence.** Reciprocal Rank Fusion over the distinct OK lists: each list adds `weight / (k + position)`, divided
   by the best possible total, so it lies in (0, 1]. `k = 60` (Cormack, Clarke, Buettcher 2009). Lists with identical
   signals count once. *Why RRF:* the contract does not say Qloo's order means "most relevant first", so a rank-based,
   scale-free method that rewards appearing in several lists is safer than trusting positions as scores.
2. **Feedback.** Interested +1, unsure +0.25, pass −1 per person, averaged over the party.
3. **Combined.** `1.0 × evidence + 1.5 × feedback (+ 0.5 if added by hand)`. Explicit opinions outweigh inference.
4. **Hard constraints are filters, not weights.** Ineligible candidates never enter ranking; no score can resurrect
   them. Hard exclusions: a person's explicit `exclude`, the organizer's group exclusion, or a Qloo tag the group
   excluded. Pass and unsure are ordinary opinions.
5. **Selection** is greedy on `score + 0.6 × (newly reached participants / party size)`, where reach comes only from
   real query results and explicit "interested". So one person's cluster cannot crowd out candidates connecting
   others. Total order for ties: score, breadth, best position, name, id. Same inputs always give the same plan.

Budget and time limits apply **only to numbers the user typed**. Entries without them are "unverified", not zero.
All weights are guesses that have never been tuned on real Qloo data.

## 7. Participant feedback

Four typed responses: Interested, Unsure, Prefer to pass, **Hard exclusion**. The organizer switches between people
and records each response; this is labelled as local. Nothing implies each person used the app or that anything syncs.
Responses can be cleared. Conflicts are explained from the data ("Mixed feedback: the group has not agreed"); the
engine never states consensus.

## 8. Plan generation and replanning

- Plan modes by category: *Outing sequence* (places), *Cultural discovery sequence* (artists, books, ...),
  *Shared-experience plan* (films, TV, games). Each carries a note that order is a sequence, not a schedule or route.
  Unknown categories fall back to shared-experience.
- Length 1 to 8 (default 3), set by the organizer. A shortfall is reported ("Only 2 of the requested 5...").
- An empty pool, an all-excluded pool, or limits no candidate fits each return a specific failure with a next step,
  never an empty success.
- Edits: move up/down (no dragging), remove, replace (best other eligible candidate; refuses if none), add by hand
  (refused if hard-excluded or over a limit), pass for the group (soft, never re-suggested but can be added back),
  hard-exclude, rename, change length, alternative, rebuild.
- "Alternative" avoids the previous entries first, keeps hand-added entries, and says so if no different valid plan
  exists. Change summaries are generated from the actual diff and the actual reasons.
- Feedback unrelated to a change is preserved.

## 9. Plan status and finalization

| Status | Meaning |
|--------|---------|
| Draft | No entries. |
| Proposed | Valid; the organizer has not confirmed this version. |
| Needs changes | A blocking issue exists: hard exclusion, limit exceeded, stale inputs, missing candidate. |
| Ready for confirmation | The organizer marked *this exact revision* ready. Any edit reverts it to Proposed. |
| Finalized | Explicitly confirmed and locked on this device. |

Every change to feedback, constraints, pool or length bumps `inputsVersion`; a plan built earlier is `stale` until it
is rebuilt or the organizer confirms it still works (which is refused while any hard problem exists). Finalizing needs
a ready plan, passing validation *now*, and an explicit confirmation. Unresolved responses stay visible as warnings,
and the screen says finalizing is not a record of everyone's approval. A finalized plan is read-only (the reducer
refuses input changes) until reopened, and an upstream party change reopens it.

## 10. Persistence

Local to the device; no database, account or sync. Expo-compatible `@react-native-async-storage/async-storage`
2.2.0 (installed with `expo install`) behind a three-method `SessionStorage` interface.

- Saved: party, participants and interests (with Qloo ids), target category, negotiation session (queries, candidates,
  feedback, constraints, plan). Not saved: the raw discovery response; credentials (none exist in the app).
- Versioned envelope (`schemaVersion` 1) with a migration table (empty so far).
- Restoring validates every field and the references between them (feedback to members, results to candidates, plan
  to party and session). Corrupt, unknown-version or inconsistent data is **copied to a backup key**, never deleted,
  and the app starts fresh with a visible notice.
- The root layout shows "Opening your adventure" until restore finishes; the provider never saves before restore, so
  an empty state cannot overwrite a good save.
- Writes are debounced and run strictly in order (a slow earlier write cannot land after a newer one) and flush when
  the app leaves the foreground. A save failure shows an error and the in-memory state keeps working.
- "Reset negotiation" (Negotiate screen) clears the session but keeps the party. "Start over" (Party screen) clears everything; an empty state removes the saved key rather than saving an empty record (tested at provider level). The provider also has a `startOver` action that clears the saved copy immediately.
- Data is stored as plain, unencrypted JSON on the device.

## 11. Qloo integration behavior

Unchanged contract. Keyless: gathering is disabled with an accurate reason, no request is sent, no candidates or plan
are produced, and the UI says "Nothing is made up". The same holds at engine level: a 503 `qloo_not_configured`
yields no candidates and a `no_candidates` outcome. Live behavior is unverified.

## 12. Error handling

Covered with tests: missing party, missing category, members without interests, over-limit selection, failed /
empty / not-sent queries, duplicates, invalid category on a manual add, invalid numbers, conflicting limits, empty or
fully excluded pool, stale or late responses, read-only finalized plan, corrupt / old / newer saved data, storage read
and write failures. Non-API errors become a generic friendly message with no stack or path details.

## 13. Tests executed (exact)

Commands run through the project's Makefile unless noted:

| Command | Result |
|---------|--------|
| `make install` | succeeded (lockfile includes AsyncStorage) |
| `make test-backend` | **73 passed, 1 deselected** (live test needs a key), 1 deprecation warning |
| `make test-mobile` | **14 suites, 170 tests, 170 passed, 0 failed, 0 skipped** |
| `make check` | **exit 0**: ruff check, ruff format, mypy (25 files), pytest 73, tsc, eslint `--max-warnings=0`, prettier, Jest 170 |
| `npx expo export --platform android` | succeeded, 1,253 modules (bundling only, not a run) |

New or changed mobile tests: negotiationPool 24, negotiationPlan 35, persistence 17, negotiationIntegration 10,
PartyProvider 10, NegotiationFlow 8, partyState 20 (includes 5 regression tests for the Phase 3 repairs). Integration tests are
**mocked HTTP** through the real API client and prove the mobile side of the contract only.

Remaining console noise: 18 pre-existing `act(...)` warnings from `BackendStatusProvider` in Phase 3 tests.

## 14. Remaining external dependencies and known limitations

External: a Qloo key (live verification), and a device or simulator (layout, real restart durability, gestures).

Genuine limitations:
- Never run on a device or simulator; screens were not viewed. Android bundling was checked, iOS was not.
- Persistence is verified at adapter and provider level via a library mock, not across a real app restart. The
  AppState flush listener and flush-on-unmount are not covered by a test.
- Whether Qloo's response order reflects relevance, and whether real recommendation entities carry `tags`, are
  unverified. Tag exclusion only works if tags come back.
- Ranking weights are untuned heuristics.
- Hand-added entries must come from a Qloo search; free-text user-created items are not supported.
- The negotiation has its own interest selection; the Phase 3 Discover screen's selection is still local to that
  screen, so there are two selection mechanisms.
- The default plan title is fixed at creation and does not follow a later party rename.
- Reorder is move up/down only. No new animation was added, so reduced-motion needed nothing new. Not tested with a
  screen reader.
- Plan building is instantaneous, so there is no "building" indicator; only gathering has stage labels (counted
  steps, no percentages).
- No LLM is used and none is claimed: planning is deterministic. It is not a multi-agent system.
- `npm audit` reports vulnerabilities in the dependency tree; not triaged.
- Feedback is recorded by the organizer on one device. No real-time or multi-device voting.

## 15. Readiness for the next phase

Ready: typed, tested, deterministic engine; honest failure states; persistence; all checks green.
Needed before relying on it: a Qloo key and a live run (`make verify-qloo`, `pytest -m live`), then a real-device
pass, then tuning the ranking against real results. Optional next steps: LLM-phrased explanations behind
server-side validation, shareable plans, verified venue data from a trusted source.
