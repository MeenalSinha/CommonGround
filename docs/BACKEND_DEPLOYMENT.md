# Backend Deployment Guide

This guide details the production deployment architecture, container configuration, environment injection, and operational procedures for the CommonGround FastAPI backend.

---

## 1. Deployment Architecture & Strategy

The CommonGround backend is packaged as a lightweight, stateless OCI-compliant container:
- **Base Image:** `python:3.11-slim` (Debian Linux).
- **Process Manager:** `uvicorn` running FastAPI with bounded timeouts (`--timeout-keep-alive 30`).
- **Security:** Runs as an unprivileged user (`appuser`, UID 1001).
- **Target Hosting Providers:** Google Cloud Run, Fly.io, Render, or AWS App Runner.
- **Why Containerization was Chosen:** Containerization guarantees identical behavior between development, CI testing, and cloud hosting. It provides automated health probes, isolated filesystem execution, zero-downtime rolling deploys, and horizontal auto-scaling without orchestrator overhead.

---

## 2. Docker Container Configuration

### 2.1 Dockerfile Structure
The `backend/Dockerfile` includes:
1. Python bytecode prevention and stdout unbuffering.
2. Creation of non-root system group and user (`appuser:appgroup`).
3. Dependency installation using pip without cache files.
4. Embedded `HEALTHCHECK` checking `http://localhost:${PORT:-8000}/health`.
5. Non-root execution.

### 2.2 Local Build & Verification
To test the container locally:
```bash
# Build the container image
docker build -t commonground-backend:latest backend

# Run the container locally
docker run -d --name commonground-backend -p 8000:8000 \
  -e LOG_LEVEL=INFO \
  -e CORS_ORIGINS="http://localhost:8081,https://commonground.app" \
  commonground-backend:latest

# Verify health
curl -f http://localhost:8000/health
curl -f http://localhost:8000/ready

# Cleanup
docker stop commonground-backend && docker rm commonground-backend
```

---

## 3. Environment & Secret Management

Inject the following environment variables through your cloud provider's secret manager:

| Secret / Variable | Recommended Source | Description |
|---|---|---|
| `QLOO_API_KEY` | Cloud Secret Manager | Secret API key from Qloo. |
| `QLOO_BASE_URL` | Environment Variable | Defaults to `https://hackathon.api.qloo.com`. |
| `CORS_ORIGINS` | Environment Variable | Comma-delimited list of allowed web frontend URLs (e.g. `https://commonground.app`). |
| `LOG_LEVEL` | Environment Variable | Set to `INFO` for production. |
| `PORT` | Cloud Provider Set | Container listener port (defaults to `8000`). |

---

## 4. Deploying to Recommended Cloud Platforms

### Option A: Google Cloud Run (Recommended)
```bash
# Authenticate and set project
gcloud auth login
gcloud config set project <PROJECT_ID>

# Build and submit image to Google Artifact Registry
gcloud builds submit --tag gcr.io/<PROJECT_ID>/commonground-backend backend

# Deploy to Cloud Run
gcloud run deploy commonground-backend \
  --image gcr.io/<PROJECT_ID>/commonground-backend \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated \
  --set-env-vars CORS_ORIGINS="https://commonground.app" \
  --set-secrets QLOO_API_KEY=qloo-api-key:latest \
  --port 8000
```

### Option B: Render
1. Create a **New Web Service** pointing to the Git repository.
2. Select **Docker** as the runtime with Dockerfile path `backend/Dockerfile`.
3. Under **Environment Variables**, add `CORS_ORIGINS` and `QLOO_API_KEY`.
4. Set Health Check Path to `/health`.
5. Deploy.

### Option C: Fly.io
```bash
cd backend
fly launch --name commonground-backend --dockerfile Dockerfile
fly secrets set QLOO_API_KEY="<YOUR_KEY>"
fly env set CORS_ORIGINS="https://commonground.app"
fly deploy
```

---

## 5. Health Checks and Monitoring

- **Liveness Probe:** `GET /health` returns HTTP 200 with JSON payload `{"status": "ok", "service": "commonground-backend", "version": "0.1.0"}`.
- **Readiness Probe:** `GET /ready` returns HTTP 200 with `{"status": "ok", "qloo_configured": true/false}`.
- **Integration Status:** `GET /api/v1/integrations/qloo/status` returns detailed engine connectivity without executing expensive billable queries.

---

## 6. Rollback & Disaster Recovery

1. **Zero-Downtime Rollback:** In Cloud Run / Render / Fly.io, navigate to revisions and select **Rollback to previous revision**.
2. **Container Registry Tagging:** Tag stable production images with semantic versions (e.g., `commonground-backend:v0.1.0`) in addition to `:latest`.
3. **Key Invalidation:** If `QLOO_API_KEY` is compromised, rotate it in the Qloo Developer Portal and update the secret in the cloud secret manager. No container rebuild is necessary.

---

## 7. Current Deployment Status

- **Status:** **DEPLOYMENT-READY, PENDING EXTERNAL HOSTING ACCESS.**
- The container image, startup lifecycle, health probes, non-root security permissions, and endpoint responses have been built and verified locally on Docker Desktop. Production deployment will proceed once cloud provider credentials are provided.

