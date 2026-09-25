import os

from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker

configured_database_url = (
    os.getenv("POSTGRES_URL_NON_POOLING")
    or os.getenv("POSTGRES_URL")
    or os.getenv("POSTGRES_PRISMA_URL")
    or os.getenv("DATABASE_URL")
)
if configured_database_url and configured_database_url.startswith("postgres://"):
    configured_database_url = "postgresql://" + configured_database_url[len("postgres://"):]
if os.getenv("VERCEL") and (
    not configured_database_url or configured_database_url.startswith("sqlite")
):
    DATABASE_URL = "sqlite:////tmp/canteen.db"
else:
    DATABASE_URL = configured_database_url or "sqlite:///./canteen.db"

engine_options = {}
if DATABASE_URL.startswith("sqlite"):
    engine_options["connect_args"] = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, **engine_options)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
