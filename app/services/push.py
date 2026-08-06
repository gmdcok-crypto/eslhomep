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


def _send_to_subscriptions(db: Session, payload: str) -> dict:
    settings = get_settings()
    private_key = settings.clean_vapid_private_key
    if not private_key or not settings.clean_vapid_public_key:
        print("push skipped: VAPID keys missing")
        return {"sent": 0, "failed": 0, "stale": 0, "total": 0, "error": "VAPID keys missing"}

    subs = db.scalars(select(PushSubscription)).all()
    if not subs:
        print("push skipped: no subscriptions")
        return {"sent": 0, "failed": 0, "stale": 0, "total": 0, "error": "no subscriptions"}

    stale_ids: list[int] = []
    sent = 0
    failed = 0
    for sub in subs:
        try:
            # pywebpush accepts raw urlsafe 32-byte private key; do NOT pass vapid_public_key
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=private_key,
                vapid_claims={
                    "sub": settings.vapid_subject or "mailto:admin@bluecs.co.kr",
                },
                ttl=86400,
                headers={"Urgency": "high", "Topic": "inquiry"},
            )
            sent += 1
        except WebPushException as exc:
            failed += 1
            status = getattr(getattr(exc, "response", None), "status_code", None)
            print(f"push failed status={status}: {exc}")
            if status in {404, 410}:
                stale_ids.append(sub.id)
        except Exception as exc:  # noqa: BLE001
            failed += 1
            print(f"push failed: {exc}")

    if stale_ids:
        for sub in subs:
            if sub.id in stale_ids:
                db.delete(sub)
        db.commit()

    result = {"sent": sent, "failed": failed, "stale": len(stale_ids), "total": len(subs)}
    print(f"push done: {result}")
    return result


def send_inquiry_push(db: Session, inquiry: Inquiry) -> dict:
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
    return _send_to_subscriptions(db, payload)


def send_test_push(db: Session) -> dict:
    payload = json.dumps(
        {
            "title": "알림 테스트",
            "body": "푸시 알림이 정상 동작합니다.",
            "url": "/admin/",
        },
        ensure_ascii=False,
    )
    return _send_to_subscriptions(db, payload)
