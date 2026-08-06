from collections.abc import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings


class Base(DeclarativeBase):
    pass


settings = get_settings()
connect_args = {"check_same_thread": False} if settings.sqlalchemy_database_url.startswith("sqlite") else {}

engine = create_engine(
    settings.sqlalchemy_database_url,
    pool_pre_ping=True,
    connect_args=connect_args,
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    from pathlib import Path

    from app import models  # noqa: F401

    if settings.sqlalchemy_database_url.startswith("sqlite"):
        Path("data").mkdir(parents=True, exist_ok=True)

    Base.metadata.create_all(bind=engine)
