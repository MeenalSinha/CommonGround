from __future__ import annotations

from fastapi import Request

from app.services.qloo_service import QlooService


def get_qloo_service(request: Request) -> QlooService:
    service: QlooService = request.app.state.qloo_service
    return service
