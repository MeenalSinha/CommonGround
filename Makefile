# Convenience wrappers. Every target is a plain command you can also run by hand (see README).
.PHONY: install install-backend install-mobile backend mobile test test-backend test-mobile check verify-qloo live-test

install: install-backend install-mobile

install-backend:
	cd backend && python3 -m venv .venv && . .venv/bin/activate && pip install -e ".[dev]"

install-mobile:
	cd apps/mobile && npm ci

backend:
	cd backend && . .venv/bin/activate && uvicorn app.main:app --reload --host 0.0.0.0 --port $${BACKEND_PORT:-8000}

mobile:
	cd apps/mobile && npx expo start

test: test-backend test-mobile

test-backend:
	cd backend && . .venv/bin/activate && pytest

test-mobile:
	cd apps/mobile && npm run test:ci

check:
	cd backend && . .venv/bin/activate && ruff check . && ruff format --check . && mypy && pytest
	cd apps/mobile && npm run check

# Requires QLOO_API_KEY in backend/.env. Makes one real authenticated request.
verify-qloo:
	cd backend && . .venv/bin/activate && python -m app.cli verify

# Optional live smoke test (skipped without a key; a skip is NOT a successful verification).
live-test:
	cd backend && . .venv/bin/activate && pytest -m live -q -rs
