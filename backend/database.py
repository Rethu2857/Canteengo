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
def create_database_engine(url):
    options = {}
    if url.startswith("sqlite"):
        options["connect_args"] = {"check_same_thread": False}
    return create_engine(url, **options)


DATABASE_URL = configured_database_url or (
    "sqlite:////tmp/canteen.db" if os.getenv("VERCEL") else "sqlite:///./canteen.db"
)
fallback_database_url = "sqlite:////tmp/canteen.db" if os.getenv("VERCEL") else "sqlite:///./canteen.db"

try:
    engine = create_database_engine(DATABASE_URL)
except Exception:
    DATABASE_URL = fallback_database_url
    engine = create_database_engine(DATABASE_URL)

if not DATABASE_URL.startswith("sqlite"):
    try:
        with engine.connect():
            pass
    except Exception:
        DATABASE_URL = fallback_database_url
        engine = create_database_engine(DATABASE_URL)

SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
