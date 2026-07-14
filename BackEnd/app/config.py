import os
from datetime import timedelta
from pathlib import Path

from dotenv import load_dotenv

# Load .env from backend/ before Config reads os.getenv().
_backend_root = Path(__file__).resolve().parent.parent
load_dotenv(_backend_root / ".env")

# Optional repo-root .env (does not override backend/.env values).
_repo_root = _backend_root.parent
if (_repo_root / ".env").exists():
    load_dotenv(_repo_root / ".env", override=False)


def _bool(value, default=False):
    if value is None:
        return default
    return str(value).lower() in {"1", "true", "yes", "on"}


def _resolve_storage_dir(value: str) -> str:
    path = Path(value)
    if not path.is_absolute():
        path = (_backend_root / path).resolve()
    path.mkdir(parents=True, exist_ok=True)
    return str(path)


class Config:
    """Central configuration loaded from environment variables.

    Nothing here is machine specific: every path/credential comes from env,
    so the same image runs identically on Windows, Linux, a VPS or the cloud.
    """

    SECRET_KEY = os.getenv("SECRET_KEY", "change-me-in-production")
    JWT_SECRET = os.getenv("JWT_SECRET", "change-me-jwt-secret")
    JWT_ACCESS_TTL = timedelta(hours=int(os.getenv("JWT_ACCESS_HOURS", "12")))

    # Database -------------------------------------------------------------
    SQLALCHEMY_DATABASE_URI = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@localhost:5432/cias",
    )
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    _db_url = SQLALCHEMY_DATABASE_URI
    SQLALCHEMY_ENGINE_OPTIONS = (
        {"pool_pre_ping": True} if not _db_url.startswith("sqlite") else {}
    )

    # Storage abstraction --------------------------------------------------
    # STORAGE_PROVIDER in {local, minio, s3}
    STORAGE_PROVIDER = (os.getenv("STORAGE_PROVIDER", "local") or "local").lower().strip()
    STORAGE_BUCKET = os.getenv("STORAGE_BUCKET", "cias-media")
    LOCAL_STORAGE_DIR = _resolve_storage_dir(os.getenv("LOCAL_STORAGE_DIR", "./storage"))

    MINIO_ENDPOINT = os.getenv("MINIO_ENDPOINT", "localhost:9000")
    MINIO_ACCESS_KEY = os.getenv("MINIO_ACCESS_KEY", "minioadmin")
    MINIO_SECRET_KEY = os.getenv("MINIO_SECRET_KEY", "minioadmin")
    MINIO_SECURE = _bool(os.getenv("MINIO_SECURE"), False)
    MINIO_PUBLIC_ENDPOINT = os.getenv("MINIO_PUBLIC_ENDPOINT", "")

    AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
    AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    S3_ENDPOINT_URL = os.getenv("S3_ENDPOINT_URL", "")

    # External services ----------------------------------------------------
    AI_SERVICE_URL = os.getenv("AI_SERVICE_URL", "http://127.0.0.1:8000")
    AI_API_KEY = os.getenv("AI_API_KEY", "claimnova_2026")
    AI_PREDICT_TIMEOUT = int(os.getenv("AI_PREDICT_TIMEOUT", "120"))
    STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
    STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET", "")
    PAYMENT_MODE = os.getenv("PAYMENT_MODE", "record")  # record | stripe

    CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")
    MAX_CONTENT_LENGTH = int(os.getenv("MAX_UPLOAD_MB", "50")) * 1024 * 1024
