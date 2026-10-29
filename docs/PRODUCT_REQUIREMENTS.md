# Product Requirements

## Overview

CommonGround helps groups whose members like different things find shared experiences. Existing recommenders optimize
for one person, popularity or votes. CommonGround uses Qloo cultural intelligence to find cross-category connections
between tastes. Audience: friends, students, couples and families. Feel: a cozy, game-like, friendly mobile adventure.

## User journey

| Step | Scope |
|------|-------|
| 1. Open CommonGround | Phase 0 (shell and status); Phase 4 restores the saved party first |
| 2. Create or join a group | Phase 3 (local party; no joining or accounts) |
| 3. Establish taste profiles | Phase 3 |
| 4. Discover cultural connections | Phase 3 (group discovery) and Phase 4 (per-person queries with provenance) |
| 5. Generate a shared plan | Phase 4 (ordered plan from real candidates) |
| 6. Review the plan | Phase 4 |
| 7. Reject or revise suggestions | Phase 4 (feedback, hard exclusions, replace, reorder, alternative) |
| 8. Finalize | Phase 4 (explicit, local to the device; not shared) |

## Functional requirements (Phases 0 and 1)

Mobile initialization and backend connectivity display; secure backend-only configuration; Qloo integration status
with explicit verification; entity resolution; one Insights operation; request validation; consistent error reporting.
Phases 3 and 4 add: local party and taste profiles; per-person and group candidate discovery with provenance;
explicit participant feedback (interested, unsure, pass, hard exclusion) recorded by the organizer; user-entered
budget and time limits; deterministic plan generation, replanning and finalization; on-device persistence.

## Non-functional requirements

Maintainability (modular, typed); security (key backend-only, redacted logs, explicit CORS); reliability (bounded
timeouts and retries); mobile responsiveness and accessibility (48 point targets, labels, roles, reduced motion,
status never by color alone); observability without secrets (request ids, structured logs); testability (no network
in unit tests); configuration via environment; user-safe error messages.

## Out of scope

Account management, real-time or multi-device sync and voting, verified venue data and scheduling, social feeds,
achievements, advanced animation and progression, payments.
