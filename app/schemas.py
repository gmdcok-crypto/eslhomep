from __future__ import annotations

from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field, field_validator


Category = Literal["hospital", "meeting", "reservation", "office", "mixed"]


class InquiryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    email: EmailStr
    message: str = Field(min_length=5, max_length=4000)
    category: Category
    company: str = Field(default="", max_length=120)
    phone: str = Field(default="", max_length=40)

    @field_validator("name", "message", "company", "phone", mode="before")
    @classmethod
    def strip_strings(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip()
        return value


class InquiryResponse(BaseModel):
    ok: bool = True
    message: str = "accepted"


class HealthResponse(BaseModel):
    ok: bool = True
    service: str = "epaper-api"


class ErrorResponse(BaseModel):
    message: str
    errors: Optional[list[str]] = None


class InquiryRead(BaseModel):
    id: int
    name: str
    email: EmailStr
    message: str
    category: Category
    company: Optional[str]
    phone: Optional[str]
    created_at: datetime

    model_config = {"from_attributes": True}


class InquiryListResponse(BaseModel):
    items: list[InquiryRead]
    total: int
    latest_id: int
