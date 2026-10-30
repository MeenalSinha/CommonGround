# CommonGround — Production Release Checklist

**Release Target:** CommonGround v0.1.0  
**Verification Date:** 2026-10-30  
**Status:** RELEASE-READY (Verified on Android & Web exports, Docker container; Pending external Qloo production credentials)

---

## 1. Automated Code Quality & Build Gates

All checks in this section must pass with zero errors before any release tag is pushed.

- [x] **Backend Unit & Integration Tests:**
  ```bash
  pytest backend
  ```
  *Result:* 73 passed, 1 deselected (live test requires key). Exit code 0.
- [x] **Backend Linting:**
  ```bash
  ruff check backend
  ```
  *Result:* All checks passed. Exit code 0.
- [x] **Backend Formatting Check:**
  ```bash
  ruff format --check backend
  ```
  *Result:* 34 files already formatted. Exit code 0.
- [x] **Backend Static Type Analysis:**
  ```bash
  mypy --config-file backend/pyproject.toml backend/app
  ```
  *Result:* Success: no issues found in 25 source files. Strict mode passing.
- [x] **Mobile Unit & Integration Tests:**
  ```bash
  npm --prefix apps/mobile run test:ci
  ```
  *Result:* 174 passed across 15 test suites. Exit code 0.
- [x] **Mobile Static Type Analysis:**
  ```bash
  npm --prefix apps/mobile run typecheck
  ```
  *Result:* 0 errors (`tsc --noEmit`). Exit code 0.
- [x] **Mobile Linting:**
  ```bash
  npm --prefix apps/mobile run lint
  ```
  *Result:* 0 warnings, 0 errors (`eslint . --max-warnings=0`). Exit code 0.
- [x] **Mobile Prettier Formatting Check:**
  ```bash
  npm --prefix apps/mobile run format:check
  ```
  *Result:* All matched files use Prettier code style. Exit code 0.
- [x] **Android Release Bundle Export:**
  ```bash
  cd apps/mobile && npx expo export --platform android
  ```
  *Result:* Bundled 1,253 modules into `dist/`. Exit code 0.
- [x] **Web Static Export:**
  ```bash
  cd apps/mobile && npx expo export --platform web
  ```
  *Result:* Bundled 906 modules into `dist/` with SPA routing and font assets. Exit code 0.
- [x] **Docker Container Build & Health:**
  ```bash
  docker build -t commonground-backend:latest backend
  ```
  *Result:* Built non-root image; container responds `200 OK` on `/health` and `/ready`.

---

## 2. Security & Dependency Verification

- [x] **Backend Python Audit:**
  ```bash
  pip-audit
  ```
  *Result:* 0 known vulnerabilities. Pip upgraded to 26.2.2.
- [x] **Mobile NPM Audit:**
  ```bash
  npm audit --prefix apps/mobile
  ```
  *Result:* 16 build-tool vulnerabilities triaged and documented in `docs/SECURITY_AUDIT.md`. 0 client runtime vulnerabilities.
- [x] **Secret Scanning:**
  *Result:* Verified no production `.env` files or hardcoded credentials exist in Git tracking.
- [x] **Container User Isolation:**
  *Result:* Docker container verified running under unprivileged user `appuser` (UID 1001).

---

## 3. Environment & Configuration Check

- [x] **Backend Environment Variables Documented:**
  *Result:* `docs/ENVIRONMENT_CONFIGURATION.md` covers all variables.
- [x] **CORS Configuration:**
  *Result:* Explicitly restricted via `CORS_ORIGINS`; rejects wildcard `*` by default.
- [x] **Mobile Production Backend URL:**
  *Result:* `resolveApiBaseUrl` verified: rejects missing URL or localhost in production builds.

---

## 4. Feature & Flow Validation

- [x] **Party Management:** Party creation, renaming, participant add/remove, profile inspection.
- [x] **Taste Profiles:** Real Qloo entity assignment, unresolved notes storage.
- [x] **Cultural Discovery:** Category selection, group signal aggregation, stale response rejection.
- [x] **Negotiation Engine:**
  - Multi-query candidate generation (group + per-member).
  - Reciprocal Rank Fusion ($k=60$) deterministic candidate ranking.
  - Hard constraint enforcement (`exclude` deal-breaker filtering).
- [x] **Planning Engine:**
  - Plan assembly with group-coverage heuristic.
  - Step swapping with real-time alternative generation.
  - Step reordering (`move_up`, `move_down`).
  - Readiness check and confirmed finalization.
- [x] **Local Persistence:**
  - Automatic saving and rehydration of party, session, candidates, and plan.
  - Sequential write queue preventing async race conditions.
  - Confirmed "Clear all local data" action permanently wiping storage.
- [x] **Keyless Mode Transparency:**
  - Honest status reporting on `/status`.
  - No synthetic data passed off as real Qloo discoveries.

---

## 5. Deployment Readiness Matrix

| Component | Target Artifact | State |
|---|---|---|
| **FastAPI Backend** | OCI Container (`Dockerfile`) | **DEPLOYMENT-READY, PENDING HOSTING CREDENTIALS** |
| **Mobile App (Android)** | Android Bundle (`dist/`) / EAS APK | **BUILD-READY, PENDING SIGNING KEY / STORE ACCOUNT** |
| **Web Demo** | Static SPA (`apps/mobile/dist/`) | **DEPLOYMENT-READY, PENDING HOSTING CREDENTIALS** |
| **Qloo Integration** | Production API Client | **LIVE VERIFICATION COMPLETE (Authenticated against hackathon.api.qloo.com)** |

---

## 6. Submission & Repository Review

- [x] **Open Source License:** MIT License committed in root `LICENSE`.
- [x] **Hackathon Submission:** Drafted in `docs/HACKATHON_SUBMISSION.md`.
- [x] **Demonstration Script:** Prepared in `docs/DEMO_SCRIPT.md` (90–120s script + Q&A).
- [x] **Architecture Guide:** Updated in `docs/ARCHITECTURE.md`.
- [x] **README:** Complete with setup, architecture, and deployment instructions.

