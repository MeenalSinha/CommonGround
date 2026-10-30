# Security and Dependency Audit

**Date:** 2026-10-30  
**Auditor:** CommonGround Security Engineering  
**Scope:** `backend/` (FastAPI / Python) and `apps/mobile/` (React Native / Expo / TypeScript)

---

## 1. Executive Summary

A comprehensive dependency and code security review was performed for both backend and mobile applications.
- **Backend (Python):** 0 known vulnerabilities in application runtime dependencies. The virtual environment's `pip` was upgraded from 25.3 to 26.2.2 to resolve build-tool CVEs. `pip-audit` reports clean (0 vulnerabilities).
- **Mobile (Node / React Native):** 16 `npm audit` findings (13 low, 3 high). Thorough tree analysis confirms that all 16 vulnerabilities reside exclusively in build-time tooling (`@expo/config`, `@expo/cli`, `jest-config`), and none are bundled into the client runtime. Applying npm's suggested fix would force a breaking downgrade to Expo 51 (React 18). These findings are accepted as isolated build-time risks.
- **Application Secrets:** Verified that no production API keys, secrets, or `.env` credential files are committed or exposed in client bundles.

---

## 2. Python Backend Security Audit

### 2.1 Audit Execution
- **Tool:** `pip-audit` (v2.10.1) using the PyPA vulnerability database.
- **Target:** `backend/.venv` (FastAPI 0.162.0, Uvicorn 0.54.0, HTTPX 0.28.1, Pydantic 2.14.2, Pydantic-Settings 2.16.2).

### 2.2 Findings & Remediations
1. **Initial scan:**
   - Flagged `pip 25.3` (10 CVEs including PYSEC-2026-1796, PYSEC-2026-2875, PYSEC-2026-2876, etc.).
   - Action: Upgraded pip to `26.2.2` via `python -m pip install --upgrade pip`.
2. **Follow-up scan:**
   - Command: `pip-audit`
   - Result: **No known vulnerabilities found.**
   - All runtime application dependencies are clean.

### 2.3 Backend Code Security Measures
- **Secret Protection:** `QLOO_API_KEY` is loaded as a Pydantic `SecretStr`. It is never logged (a custom log filter scrubs any appearance of the raw secret) and never returned in API responses.
- **CORS Policy:** Restricts allowed origins using environment-configured `CORS_ORIGINS`. Defaults to strict rejection when unconfigured.
- **Request Tracing:** All incoming requests receive an `X-Request-ID` header for log tracing without exposing personal identifiers.
- **Container Hardening:** `backend/Dockerfile` runs under an unprivileged `appuser:appgroup` (UID/GID 1001) rather than root, uses multi-stage layering, and contains an automated health check probe.

---

## 3. Mobile Application Security Audit

### 3.1 Audit Execution
- **Tool:** `npm audit` (v11.6.0) across 1,393 audited packages in `apps/mobile/`.
- **Target:** Expo 58 SDK, React Native 0.88, React 19.3.0.

### 3.2 Findings Breakdown

| Package | Severity | Advisory / CVE | Dependency Path | Context | Risk Evaluation |
|---|---|---|---|---|---|
| `deepmerge` (>=4.2.0) | Low (13 instances) | GHSA-gcqx-w48m-w2h4 (prototype pollution) | `@expo/config`, `jest-config` | Build tool / Test runner | **Accepted Risk**: Executes only during static export and Jest testing on developer/CI machines; not part of client runtime code. |
| `zod` (<4.6.6) | High (3 instances) | GHSA-mrhx-c7xc-m3w5 (memory exhaustion) | `@expo/cli` → `@expo/metro-config` | Build tool | **Accepted Risk**: Used by the Expo CLI bundler during local development and build compilation. Does not execute on the end user's device or handle untrusted input at runtime. |

### 3.3 Why `npm audit fix --force` was Rejected
Running `npm audit fix --force` attempts to resolve these build-tool dependencies by downgrading `expo` to `51.0.39`. Doing so would:
1. Break compatibility with React 19.3 and React Native 0.88.
2. Revert Expo Router v58 to v51, breaking modern typed routing and web export capabilities.
3. Introduce regressions and security gaps into the application core.

Because neither `deepmerge` nor `zod` is bundled into the client runtime artifacts, the actual risk to users is negligible.

### 3.4 Mobile Privacy & Storage Verification
- **Storage:** Local storage uses `@react-native-async-storage/async-storage`.
- **Transparency:** All storage is local-first. A dedicated `PrivacyPanel` on the `/status` screen explicitly informs users that their party profiles and plans are stored locally as unencrypted JSON on their device.
- **Destructive Deletion:** A confirmed "Clear all local data" action allows users to permanently wipe local storage at any time.
- **Telemetry / Tracking:** No analytics SDKs, advertising IDs, or tracking cookies are included.

---

## 4. Continuous Security Verification

To ensure ongoing dependency hygiene:
1. `pip-audit` runs against backend virtual environments.
2. CI builds fail if unauthorized secrets are committed.
3. Docker image builds are validated without root execution.

