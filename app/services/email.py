import smtplib
from email.message import EmailMessage

from app.config import get_settings
from app.models import Inquiry

CATEGORY_LABELS = {
    "hospital": "병원 병상 네임텍",
    "meeting": "회의실 전자명패",
    "reservation": "예약 룸·테이블",
    "office": "관공서·사무실 명패",
    "mixed": "복합/기타",
}


def maybe_send_inquiry_email(inquiry: Inquiry) -> None:
    settings = get_settings()
    if not settings.smtp_host or not settings.inquiry_to:
        return

    message = EmailMessage()
    message["Subject"] = (
        f"[e-PAPER] 문의 — {CATEGORY_LABELS.get(inquiry.category, inquiry.category)}"
    )
    message["From"] = settings.smtp_from or settings.smtp_user or "noreply@epaper.local"
    message["To"] = settings.inquiry_to
    message["Reply-To"] = inquiry.email
    message.set_content(
        "\n".join(
            [
                f"이름: {inquiry.name}",
                f"회사/기관: {inquiry.company or '-'}",
                f"이메일: {inquiry.email}",
                f"연락처: {inquiry.phone or '-'}",
                f"분야: {CATEGORY_LABELS.get(inquiry.category, inquiry.category)}",
                f"접수: {inquiry.created_at.isoformat()}",
                "",
                inquiry.message,
            ]
        )
    )

    with smtplib.SMTP(settings.smtp_host, settings.smtp_port) as smtp:
        if settings.smtp_secure:
            smtp.starttls()
        if settings.smtp_user:
            smtp.login(settings.smtp_user, settings.smtp_pass or "")
        smtp.send_message(message)
