from __future__ import annotations

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from tests.conftest import FAKE_KEY, make_settings


def test_missing_key_is_unconfigured() -> None:
    settings = make_settings()
    assert settings.qloo_configured is False
    assert settings.qloo_key_value() is None


@pytest.mark.parametrize("blank", ["", "   ", "\n"])
def test_blank_key_never_becomes_an_empty_header(blank: str) -> None:
    settings = make_settings(qloo_api_key=blank)
    assert settings.qloo_configured is False
    assert settings.qloo_key_value() is None


def test_configured_key_is_read_from_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("QLOO_API_KEY", FAKE_KEY)
    monkeypatch.setenv("CORS_ORIGINS", "http://a.test, http://b.test")
    settings = Settings(_env_file=None)
    assert settings.qloo_configured is True
    assert settings.qloo_key_value() == FAKE_KEY
    assert settings.cors_origins == ["http://a.test", "http://b.test"]


def test_secret_not_in_repr() -> None:
    settings = make_settings(qloo_api_key=FAKE_KEY)
    assert FAKE_KEY not in repr(settings)
    assert FAKE_KEY not in str(settings.model_dump())


def test_invalid_base_url_has_clear_error() -> None:
    with pytest.raises(ValidationError, match="QLOO_BASE_URL"):
        make_settings(qloo_base_url="ftp://nope")


def test_invalid_log_level_has_clear_error() -> None:
    with pytest.raises(ValidationError, match="LOG_LEVEL"):
        make_settings(log_level="LOUD")


def test_base_url_trailing_slash_removed() -> None:
    assert make_settings(qloo_base_url="https://x.test/").qloo_base_url == "https://x.test"
