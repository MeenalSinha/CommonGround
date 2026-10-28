# Product Requirements

## Overview

CommonGround helps groups whose members like different things find shared experiences. Existing recommenders optimize
for one person, popularity or votes. CommonGround uses Qloo cultural intelligence to find cross-category connections
between tastes. Audience: friends, students, couples and families. Feel: a cozy, game-like, friendly mobile adventure.

## User journey

| Step | Scope |
|------|-------|
| 1. Open CommonGround | Phase 0 (shell and status) |
| 2. Create or join a group | Later |
| 3. Establish taste profiles | Later (entity search in Phase 1 is the building block) |
| 4. Discover cultural connections | Later (Insights operation in Phase 1 is the building block) |
| 5. Generate a shared plan | Later |
| 6. Review the plan | Later |
| 7. Reject or revise suggestions | Later |
| 8. Finalize | Later |

## Functional requirements (Phases 0 and 1)

Mobile initialization and backend connectivity display; secure backend-only configuration; Qloo integration status
with explicit verification; entity resolution; one Insights operation; request validation; consistent error reporting.
Future: cultural discovery and group planning.

## Non-functional requirements

Maintainability (modular, typed); security (key backend-only, redacted logs, explicit CORS); reliability (bounded
timeouts and retries); mobile responsiveness and accessibility (48 point targets, labels, roles, reduced motion,
status never by color alone); observability without secrets (request ids, structured logs); testability (no network
in unit tests); configuration via environment; user-safe error messages.

## Out of scope

Account management, real-time multi-user sync, the negotiation algorithm, itinerary generation, social feeds,
achievements, advanced animation and progression, payments.
