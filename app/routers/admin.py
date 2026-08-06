from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.config import get_settings
from app.database import get_db
from app.dependencies import require_admin_key
from app.models import Inquiry, PushSubscription
from app.services.push import send_test_push
from app.schemas import InquiryListResponse, InquiryRead, PushSubscribeRequest, VapidPublicResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/inquiries", response_model=InquiryListResponse)
def list_inquiries(
    _auth: None = Depends(require_admin_key),
    db: Session = Depends(get_db),
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    since_id: Optional[int] = Query(default=None, ge=0),
) -> InquiryListResponse:
    total = db.scalar(select(func.count()).select_from(Inquiry)) or 0
    latest_id = db.scalar(select(func.max(Inquiry.id))) or 0

    query = select(Inquiry).order_by(desc(Inquiry.id))
    if since_id is not None:
        query = query.where(Inquiry.id > since_id)
    else:
        query = query.offset(offset)

    items = db.scalars(query.limit(limit)).all()

    return InquiryListResponse(
        items=[InquiryRead.model_validate(item) for item in items],
        total=total,
        latest_id=latest_id,
    )


@router.delete("/inquiries/{inquiry_id}")
def delete_inquiry(
    inquiry_id: int,
    _auth: None = Depends(require_admin_key),
    db: Session = Depends(get_db),
) -> dict:
    inquiry = db.get(Inquiry, inquiry_id)
    if not inquiry:
        raise HTTPException(status_code=404, detail="문의를 찾을 수 없습니다.")
    db.delete(inquiry)
    db.commit()
    return {"ok": True, "message": "deleted", "id": inquiry_id}


@router.get("/push/vapid-public-key", response_model=VapidPublicResponse)
def get_vapid_public_key(_auth: None = Depends(require_admin_key)) -> VapidPublicResponse:
    import base64

    settings = get_settings()
    public_key = settings.clean_vapid_public_key
    if not public_key:
        raise HTTPException(status_code=503, detail="푸시 알림이 설정되지 않았습니다.")

    try:
        padded = public_key + ("=" * (-len(public_key) % 4))
        raw = base64.urlsafe_b64decode(padded.encode("ascii"))
    except Exception as exc:  # noqa: BLE001
        raise HTTPException(status_code=500, detail=f"VAPID 공개키 형식이 올바르지 않습니다: {exc}") from exc

    if len(raw) != 65 or raw[0] != 0x04:
        raise HTTPException(
            status_code=500,
            detail="VAPID 공개키가 올바르지 않습니다. 65바이트 uncompressed key(0x04...)여야 합니다.",
        )

    return VapidPublicResponse(publicKey=public_key)


@router.post("/push/subscribe")
def subscribe_push(
    payload: PushSubscribeRequest,
    request: Request,
    _auth: None = Depends(require_admin_key),
    db: Session = Depends(get_db),
) -> dict:
    existing = db.scalar(
        select(PushSubscription).where(PushSubscription.endpoint == payload.endpoint)
    )
    if existing:
        existing.p256dh = payload.keys["p256dh"]
        existing.auth = payload.keys["auth"]
        existing.user_agent = (request.headers.get("user-agent") or "")[:255]
    else:
        db.add(
            PushSubscription(
                endpoint=payload.endpoint,
                p256dh=payload.keys["p256dh"],
                auth=payload.keys["auth"],
                user_agent=(request.headers.get("user-agent") or "")[:255],
            )
        )
    db.commit()
    return {"ok": True, "message": "subscribed"}


@router.post("/push/test")
def test_push(
    _auth: None = Depends(require_admin_key),
    db: Session = Depends(get_db),
) -> dict:
    result = send_test_push(db)
    if result.get("sent", 0) < 1:
        raise HTTPException(
            status_code=400,
            detail=(
                "푸시를 보낼 구독이 없거나 만료되었습니다. "
                "이 기기에서 알림 켜기를 다시 눌러 주세요."
            ),
        )
    return {"ok": True, "message": "test push sent", **result}
