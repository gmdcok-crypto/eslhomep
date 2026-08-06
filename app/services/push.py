from __future__ import annotations

import json

from pywebpush import WebPushException, webpush
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.models import Inquiry, PushSubscription

CATEGORY_LABELS = {
    "hospital": "병원 병상 네임텍",
    "meeting": "회의실 전자명패",
    "reservation": "예약 룸·테이블",
    "office": "관공서·사무실 명패",
    "mixed": "복합/기타",
}


def send_inquiry_push(db: Session, inquiry: Inquiry) -> None:
    settings = get_settings()
    if not settings.vapid_public_key or not settings.vapid_private_key:
        return

    subs = db.scalars(select(PushSubscription)).all()
    if not subs:
        return

    title = "새 문의 접수"
    body = f"{inquiry.name} · {CATEGORY_LABELS.get(inquiry.category, inquiry.category)}"
    payload = json.dumps(
        {
            "title": title,
            "body": body,
            "url": "/admin/",
            "inquiryId": inquiry.id,
        },
        ensure_ascii=False,
    )

    stale_ids: list[int] = []
    for sub in subs:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.vapid_private_key,
                vapid_claims={
                    "sub": settings.vapid_subject or "mailto:admin@bluecs.co.kr",
                },
                vapid_public_key=settings.vapid_public_key,
            )
        except WebPushException as exc:
            status = getattr(getattr(exc, "response", None), "status_code", None)
            print(f"push failed: {exc}")
            if status in {404, 410}:
                stale_ids.append(sub.id)
        except Exception as exc:  # noqa: BLE001
            print(f"push failed: {exc}")

    if stale_ids:
        for sub in subs:
            if sub.id in stale_ids:
                db.delete(sub)
        db.commit()
