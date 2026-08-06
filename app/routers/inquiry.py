from fastapi import APIRouter, Depends, Request
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.orm import Session

from app.database import get_db
from app.models import Inquiry
from app.schemas import InquiryCreate, InquiryResponse
from app.services.email import maybe_send_inquiry_email
from app.services.push import send_inquiry_push

router = APIRouter(prefix="/api", tags=["inquiry"])
limiter = Limiter(key_func=get_remote_address)


@router.post("/inquiry", response_model=InquiryResponse, status_code=201)
@limiter.limit("20/15minutes")
def create_inquiry(
    request: Request,
    payload: InquiryCreate,
    db: Session = Depends(get_db),
) -> InquiryResponse:
    inquiry = Inquiry(
        name=payload.name,
        email=payload.email,
        message=payload.message,
        category=payload.category,
        company=payload.company or None,
        phone=payload.phone or None,
    )
    db.add(inquiry)
    db.commit()
    db.refresh(inquiry)

    try:
        maybe_send_inquiry_email(inquiry)
    except Exception as exc:  # noqa: BLE001
        print(f"email failed: {exc}")

    try:
        send_inquiry_push(db, inquiry)
    except Exception as exc:  # noqa: BLE001
        print(f"push failed: {exc}")

    return InquiryResponse()
