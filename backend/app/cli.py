"""Developer CLI.

python -m app.cli check-config   # reports whether a key is configured (never prints it)
python -m app.cli verify         # performs one real authenticated request and records the result
"""

from __future__ import annotations

import argparse
import asyncio
import json
import sys
from datetime import UTC, datetime
from pathlib import Path

from app.core.config import Settings
from app.core.errors import AppError
from app.integrations.qloo.client import QlooClient
from app.services.qloo_service import QlooService
from app.services.status_tracker import StatusTracker

RESULT_FILE = Path(".qloo_verification.json")  # git-ignored; contains no secrets


async def _verify(settings: Settings) -> int:
    if not settings.qloo_configured:
        print("Qloo is NOT configured: set QLOO_API_KEY in backend/.env. No request was made.")
        return 2
    client = QlooClient(settings)
    service = QlooService(settings, client, StatusTracker(settings))
    record: dict[str, object] = {
        "checked_at": datetime.now(UTC).isoformat(),
        "base_host": service.status().base_host,
    }
    try:
        status = await service.verify()
        record.update(state=status.state.value, ready=status.ready)
        code = 0 if status.ready else 1
        print(f"Qloo status: {status.state.value} - {status.message}")
    except AppError as exc:
        record.update(state="error", error_code=exc.code, ready=False)
        print(f"Verification failed: {exc.code} - {exc.message}")
        code = 1
    finally:
        await client.aclose()
    RESULT_FILE.write_text(json.dumps(record, indent=2) + "\n", encoding="utf-8")
    print(f"Result recorded in {RESULT_FILE} (no credentials included).")
    return code


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.cli")
    parser.add_argument("command", choices=["check-config", "verify"])
    args = parser.parse_args(argv)
    settings = Settings()
    if args.command == "check-config":
        print(f"QLOO_API_KEY configured: {settings.qloo_configured}")
        print(f"QLOO_BASE_URL: {settings.qloo_base_url}")
        return 0
    return asyncio.run(_verify(settings))


if __name__ == "__main__":
    sys.exit(main())
