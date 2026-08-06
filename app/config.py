from __future__ import annotations

from functools import lru_cache
from typing import Optional

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    port: int = 8080
    cors_origins: str = (
        "http://localhost:5500,"
        "http://127.0.0.1:5500,"
        "https://esl.bluecs.co.kr,"
        "https://eslsub.netlify.app"
    )
    database_url: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("DATABASE_URL", "MYSQL_URL"),
    )
    mysql_host: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("MYSQL_HOST", "MYSQLHOST"),
    )
    mysql_port: int = Field(
        default=3306,
        validation_alias=AliasChoices("MYSQL_PORT", "MYSQLPORT"),
    )
    mysql_user: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("MYSQL_USER", "MYSQLUSER"),
    )
    mysql_password: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("MYSQL_PASSWORD", "MYSQLPASSWORD"),
    )
    mysql_database: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("MYSQL_DATABASE", "MYSQLDATABASE"),
    )
    smtp_host: Optional[str] = None
    smtp_port: int = 587
    smtp_secure: bool = False
    smtp_user: Optional[str] = None
    smtp_pass: Optional[str] = None
    smtp_from: Optional[str] = None
    inquiry_to: Optional[str] = None
    admin_api_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("ADMIN_API_KEY", "ADMIN_KEY"),
    )
    vapid_public_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("VAPID_PUBLIC_KEY"),
    )
    vapid_private_key: Optional[str] = Field(
        default=None,
        validation_alias=AliasChoices("VAPID_PRIVATE_KEY"),
    )
    vapid_subject: str = Field(
        default="mailto:admin@bluecs.co.kr",
        validation_alias=AliasChoices("VAPID_SUBJECT"),
    )

    @staticmethod
    def _clean_key(value: Optional[str]) -> Optional[str]:
        if not value:
            return None
        cleaned = value.strip().strip('"').strip("'").replace("\n", "").replace("\r", "").replace(" ", "")
        return cleaned or None

    @property
    def clean_vapid_public_key(self) -> Optional[str]:
        return self._clean_key(self.vapid_public_key)

    @property
    def clean_vapid_private_key(self) -> Optional[str]:
        return self._clean_key(self.vapid_private_key)

    @property
    def cors_origin_list(self) -> list[str]:
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def sqlalchemy_database_url(self) -> str:
        if self.database_url:
            if self.database_url.startswith("mysql://"):
                return self.database_url.replace("mysql://", "mysql+pymysql://", 1)
            return self.database_url

        if self.mysql_host and self.mysql_user and self.mysql_database:
            password = self.mysql_password or ""
            return (
                f"mysql+pymysql://{self.mysql_user}:{password}"
                f"@{self.mysql_host}:{self.mysql_port}/{self.mysql_database}"
            )

        return "sqlite:///./data/inquiries.db"


@lru_cache
def get_settings() -> Settings:
    return Settings()
