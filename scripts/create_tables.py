"""Create inquiry tables using DATABASE_URL / MYSQL* env vars."""

from __future__ import annotations

import os
import sys

# Allow running from repo root
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.config import get_settings
from app.database import init_db


def main() -> None:
    settings = get_settings()
    print(f"Connecting with: {settings.sqlalchemy_database_url.split('@')[-1]}")
    init_db()
    print("OK: inquiries table is ready.")


if __name__ == "__main__":
    main()
