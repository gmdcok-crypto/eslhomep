from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import desc, func, select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_admin_key
from app.models import Inquiry
from app.schemas import InquiryListResponse, InquiryRead

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
