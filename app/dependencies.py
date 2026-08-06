from __future__ import annotations

from typing import Optional

from fastapi import Header, HTTPException

from app.config import get_settings


def require_admin_key(x_admin_key: Optional[str] = Header(default=None, alias="X-Admin-Key")) -> None:
    settings = get_settings()
    if not settings.admin_api_key:
        raise HTTPException(status_code=503, detail="관리자 API가 설정되지 않았습니다.")
    if not x_admin_key or x_admin_key != settings.admin_api_key:
        raise HTTPException(status_code=401, detail="인증에 실패했습니다.")
