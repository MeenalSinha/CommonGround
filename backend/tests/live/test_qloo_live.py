"""Optional live smoke test. Never runs by default.

Run only with a real key present in the environment or backend/.env:

    pytest -m live -q

Without a key every test here is SKIPPED, and a skip is not a successful live verification.
"""

from __future__ import annotations

import pytest

from app.core.config import Settings
from app.integrations.qloo.client import QlooClient

pytestmark = pytest.mark.live


@pytest.fixture
def live_settings() -> Settings:
    settings = Settings()
    if not settings.qloo_configured:
        pytest.skip("QLOO_API_KEY is not set: live Qloo verification NOT performed")
    return settings


async def test_live_search_and_insights(live_settings: Settings) -> None:
    client = QlooClient(live_settings)
    try:
        search = await client.search_entities(live_settings.qloo_verify_query, take=3)
        assert search.no_results_status is False, "search returned the documented 404 No results"
        assert search.entities, "authenticated search returned no entities"
        first = search.entities[0]
        assert first.entity_id and first.name

        insights = await client.get_insights(
            filter_type="urn:entity:artist", entity_ids=[first.entity_id], take=3
        )
        print(f"live ok: search={len(search.entities)} insights={len(insights.entities)}")
    finally:
        await client.aclose()
