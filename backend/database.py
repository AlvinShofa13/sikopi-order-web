import os
from dotenv import load_dotenv
from sqlalchemy import create_engine, text
from sqlalchemy.orm import declarative_base, sessionmaker

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./sikopi.db")

# SQLite needs connect_args={"check_same_thread": False}
connect_args = {"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def ensure_schema():
    """Migrasi ringan saat startup. create_all() tidak menambah/menghapus kolom
    di tabel lama, jadi perubahan kolom diurus di sini secara idempoten."""
    with engine.begin() as conn:
        cols = [r[1] for r in conn.execute(text("PRAGMA table_info(orders)")).fetchall()]
        if "is_paid" not in cols:
            conn.execute(text("ALTER TABLE orders ADD COLUMN is_paid BOOLEAN DEFAULT 0"))
            conn.execute(text(
                "UPDATE orders SET is_paid = 1 "
                "WHERE payment_status IN ('Sudah Lunas', 'Lunas', 'Sudah Dibayar')"
            ))
        for dead in ("qris_payload", "qris_image_url"):
            if dead in cols:
                conn.execute(text(f"ALTER TABLE orders DROP COLUMN {dead}"))
