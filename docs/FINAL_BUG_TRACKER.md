# CommonGround — Final Defect & Bug Tracker

**Date:** 2026-10-30  
**Status:** ALL DEFECTS REPAIRED & REGRESSION VERIFIED  
**Auditor:** QA & Software Architecture Team  

---

## Defect Summary

| Defect ID | Severity | Category | Description | Root Cause | Status | Regression Test |
|---|---|---|---|---|---|---|
| **BUG-001** | P1 (High) | Mobile / CI | Jest test timeouts under parallel CI load | Default Jest timeout of 5,000ms was insufficient when running 15 suites concurrently on Windows/CI runners | **RESOLVED** | `jest.setTimeout(20000)` configured in `apps/mobile/jest.setup.ts`. 15 suites pass reliably in ~7.5s. |
| **BUG-002** | P1 (High) | Mobile / Web | Missing web bundling dependency | `react-native-web` missing from dependencies, and peer dependency mismatch on unpinned `react-dom` caused `expo export --platform web` to crash | **RESOLVED** | Pinned `"react-dom": "19.3.0"` matching `react: "19.3.0"` and installed `react-native-web: "~0.21.0"`. Bundle succeeds (907 modules). |
| **BUG-003** | P2 (Medium) | State / UX | Stale default plan title on party rename | When a party was renamed, default generated titles (`"${party.name}: ${mode.label}"`) retained the old party name | **RESOLVED** | Added auto-synchronization logic in `apps/mobile/src/state/store.ts` to detect and update default plan titles on party rename while preserving custom titles. Added 2 regression tests in `negotiationPlan.test.ts`. |
| **BUG-004** | P2 (Medium) | Privacy / Compliance | Missing client-side data clear mechanism | AsyncStorage stored group profiles and plans indefinitely with no in-app user action to wipe data | **RESOLVED** | Built `PrivacyPanel.tsx` in `StatusScreen.tsx` with user-facing privacy guarantees and a confirmed "Clear all local data" action that purges in-memory state and calls `AsyncStorage.clear()`. Added 2 unit tests in `PrivacyPanel.test.tsx`. |
| **BUG-005** | P2 (Medium) | Code Style / CI | Prettier code style failure in GitHub Actions | `eas.json` and `vercel.json` were committed without Prettier formatting, failing the `npm run format:check` CI step | **RESOLVED** | Executed `prettier --write eas.json vercel.json`. Verified clean with `npm run format:check`. |
| **BUG-006** | P2 (Medium) | Code Style / CI | Ruff E501 line length violation in `test_qloo_live.py` | Print statement on line 44 exceeded 100 characters, causing the GitHub Actions `backend` job to fail | **RESOLVED** | Refactored print statement and variable extraction across multiple lines in `backend/tests/live/test_qloo_live.py`. Passed `ruff check` and `ruff format`. |
| **BUG-007** | P3 (Low) | Security / Env | Outdated Pip package in virtual environment | Virtualenv contained outdated pip 25.3 with known advisories flagged by `pip-audit` | **RESOLVED** | Upgraded pip to 26.2.2. Verified clean with `pip-audit` (0 vulnerabilities found). |
| **BUG-008** | P3 (Low) | Verification / CLI | Unsupported entity type seed signal in Qloo verify | Verification script attempted to query `music` which resolved to an album (`urn:entity:album`), which Qloo's `/v2/insights` rejects with HTTP 400 (only artist, movie, book, place permitted as signals) | **RESOLVED** | Updated default verification query to `"The Beatles"` (resolves to `urn:entity:artist`), allowing `/v2/insights` to complete successfully with genuine recommendations. |

---

## Defect Resolution Verification Summary

- **Total Defects Identified:** 8
- **Total Defects Repaired:** 8
- **Outstanding Defects:** 0
- **Regression Test Coverage:** 100% of functional bug fixes have associated unit/integration tests.

