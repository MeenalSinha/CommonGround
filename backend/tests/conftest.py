from __future__ import annotations

from collections.abc import Callable
from typing import Any

import httpx
import pytest

from app.core.config import Settings

# Obviously fake value used only to prove secrets are handled correctly. Not a real credential.
FAKE_KEY = "test-key-not-a-real-credential-0001"


def make_settings(**overrides: Any) -> Settings:
    """Settings that ignore .env files and the process environment for the Qloo key."""
    values: dict[str, Any] = {"qloo_api_key": None, "qloo_base_url": "https://qloo.test"}
    values.update(overrides)
    return Settings(_env_file=None, **values)


class Recorder:
    """Mock upstream transport that records every request it receives."""

    def __init__(self, handler: Callable[[httpx.Request], httpx.Response]) -> None:
        self.requests: list[httpx.Request] = []
        self._handler = handler
        self.transport = httpx.MockTransport(self._handle)

    def _handle(self, request: httpx.Request) -> httpx.Response:
        self.requests.append(request)
        return self._handler(request)


@pytest.fixture
def fake_key() -> str:
    return FAKE_KEY


async def no_sleep(_: float) -> None:
    return None
