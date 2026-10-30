# Environment Configuration Guide

This document details all configuration variables for CommonGround, distinguishing development, staging/preview, and production environments, and explaining where each variable lives.

---

## 1. Backend Environment Variables (`backend/.env`)

The backend is configured via environment variables read by Pydantic Settings (`app.core.config.Settings`).

| Variable | Type | Default | Required in Prod? | Description |
|---|---|---|---|---|
| `QLOO_API_KEY` | Secret String | `None` | Optional (enables live Qloo) | API key for authenticating with Qloo. Must be kept strictly server-side. |
| `QLOO_BASE_URL` | String | `https://hackathon.api.qloo.com` | No | Base URL for Qloo API. Must begin with `https://` (or `http://` for local test mocks). |
| `QLOO_TIMEOUT_SECONDS`| Float | `10.0` | No | HTTP timeout for outbound Qloo requests (1–60s). |
| `QLOO_MAX_RETRIES` | Integer | `2` | No | Maximum automated retries for transient 5xx or timeout errors (0–5). |
| `QLOO_VERIFY_QUERY` | String | `music` | No | Query string used during the one-time `verify-qloo` check. |
| `BACKEND_PORT` | Integer | `8000` | No | Port on which the FastAPI server listens. |
| `PORT` | Integer | `8000` | No | Standard cloud container port override (e.g. Cloud Run, Render, Fly). |
| `LOG_LEVEL` | String | `INFO` | No | Logging verbosity: `DEBUG`, `INFO`, `WARNING`, `ERROR`, `CRITICAL`. |
| `CORS_ORIGINS` | Comma-separated | `[]` (empty) | **Yes** | Allowed frontend origins (e.g., `https://commonground.example.com,http://localhost:8081`). |

### Backend Environment Matrix

| Setting | Local Development | Preview / Staging | Production |
|---|---|---|---|
| `LOG_LEVEL` | `DEBUG` | `INFO` | `INFO` |
| `CORS_ORIGINS` | `http://localhost:8081,http://localhost:19006` | `https://preview.commonground.app` | `https://commonground.app` |
| `QLOO_API_KEY` | Developer key in `.env` | Staging key via cloud secrets | Production key via cloud secrets |
| `QLOO_BASE_URL` | `https://hackathon.api.qloo.com` | `https://hackathon.api.qloo.com` | Official Qloo endpoint |

---

## 2. Mobile Environment Variables (`apps/mobile/.env`)

Mobile configuration is read at bundle time by Expo using the `EXPO_PUBLIC_` prefix.

| Variable | Default | Required in Prod? | Description |
|---|---|---|---|
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:8000` (Dev only) | **Yes** | Base URL of the CommonGround backend. Must begin with `http://` or `https://`. In production, omitting this throws an explicit build/runtime error. |

> **Security Rule:** Never put private API keys or server credentials into `apps/mobile/.env`. Any variable prefixed with `EXPO_PUBLIC_` is baked directly into the JavaScript bundle and is publicly inspectable.

### Mobile Environment Matrix

| Build Profile | Target URL | EAS Build Profile | Notes |
|---|---|---|---|
| **Development** | `http://localhost:8000` | `development` | Used with local Metro bundler and simulators. |
| **Preview** | `https://api-staging.commonground.app` | `preview` | Generates standalone preview APK / TestFlight builds. |
| **Production** | `https://api.commonground.app` | `production` | Deployed web client and production mobile app. |

---

## 3. Template Files

Both projects provide clean templates:
- `backend/.env.example`: Sample backend environment file.
- `apps/mobile/.env.example`: Sample mobile environment file.

Neither template contains real keys or secrets. Actual `.env` files are ignored by `.gitignore`.

