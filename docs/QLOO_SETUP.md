# Qloo Setup

## Current status

Live Qloo verification: NOT performed. No API key has been issued yet. Everything else works without it.

## Getting a key

Follow the official hackathon developer guide: https://docs.qloo.com/reference/qloo-llm-hackathon-developer-guide
(Qloo's general onboarding page says keys are issued by contacting Qloo support.) Keys are issued by Qloo; never paste
yours into a chat, an issue, a screenshot or a commit.

## Adding the key (when it arrives)

1. `cd backend && cp .env.example .env` (the file is git-ignored).
2. Put the key after `QLOO_API_KEY=` in `backend/.env`. Confirm `QLOO_BASE_URL` matches the instructions you received.
3. Restart the backend (`make backend`). Settings are read at startup.
4. Check configuration without any network call: `python -m app.cli check-config` (prints only true or false).
5. Verify with one real request: `python -m app.cli verify` (or press "Verify with Qloo" in the app).
   The result is recorded without credentials in `backend/.qloo_verification.json` (git-ignored).
6. Run the live smoke test: `pytest -m live -q -rs`. It searches, then requests Insights for the first returned entity.
   Without a key it is reported as SKIPPED, which is not a pass.
7. If you are hosting the backend, set the same variables in your host's secret manager rather than a file.

Only after step 5 or 6 succeeds should anything be described as "verified". Then update `docs/PHASE_1_REPORT.md`.

## If something fails

| Symptom | Likely cause |
|---------|--------------|
| `qloo_not_configured` | Key missing or blank; restart after editing `.env`. |
| `qloo_auth_failed` | Wrong key, or wrong `QLOO_BASE_URL` for that key's environment. |
| `qloo_invalid_response` on search | The search response shape differs from the tolerant parser (see API_CONTRACT section 3). Adjust only `app/integrations/qloo/parsers.py`. |
| `qloo_rate_limited` | Wait for `Retry-After`; avoid repeated verification. |
| App shows "Backend offline" | Wrong `EXPO_PUBLIC_API_BASE_URL` for your device (see `apps/mobile/.env.example`). |

## Security notes

- The key exists only in backend environment variables and is sent only as the `X-Api-Key` header.
- The mobile app has no access to it. `EXPO_PUBLIC_*` values are public by design.
- Logs pass through a redaction filter; status endpoints never return credentials.
