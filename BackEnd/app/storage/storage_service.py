from __future__ import annotations

from flask import current_app

from .base import StorageProvider, StoredObject
from .local_provider import LocalStorageProvider


class StorageService:
    """Single entry point used by the whole application for file I/O.

    Usage:
        svc = get_storage()
        stored = svc.save(file_bytes, folder="vehicles", filename="rc.jpg",
                          content_type="image/jpeg")
        # persist stored.object_key in PostgreSQL, never the bytes
        url = svc.url(stored.object_key)
    """

    def __init__(self, provider: StorageProvider):
        self.provider = provider

    @classmethod
    def from_config(cls, config) -> "StorageService":
        kind = (config.get("STORAGE_PROVIDER") or "local").lower().strip()
        bucket = config["STORAGE_BUCKET"]

        if kind == "local":
            provider = LocalStorageProvider(
                bucket=bucket, base_dir=config["LOCAL_STORAGE_DIR"]
            )
        elif kind == "minio":
            from .minio_provider import MinioStorageProvider

            provider = MinioStorageProvider(
                bucket=bucket,
                endpoint=config["MINIO_ENDPOINT"],
                access_key=config["MINIO_ACCESS_KEY"],
                secret_key=config["MINIO_SECRET_KEY"],
                secure=config["MINIO_SECURE"],
                public_endpoint=config.get("MINIO_PUBLIC_ENDPOINT", ""),
            )
        elif kind == "s3":
            from .s3_provider import S3StorageProvider

            provider = S3StorageProvider(
                bucket=bucket,
                region=config["AWS_REGION"],
                access_key=config["AWS_ACCESS_KEY_ID"],
                secret_key=config["AWS_SECRET_ACCESS_KEY"],
                endpoint_url=config.get("S3_ENDPOINT_URL", ""),
            )
        else:
            raise ValueError(f"Unknown STORAGE_PROVIDER: {kind!r}")

        return cls(provider)

    # Public API -----------------------------------------------------------
    def save(self, data: bytes, folder: str, filename: str,
             content_type: str = "application/octet-stream") -> StoredObject:
        key = self.provider.build_key(folder, filename)
        return self.provider.upload(data, key, content_type)

    def read(self, object_key: str) -> bytes:
        return self.provider.download(object_key)

    def remove(self, object_key: str) -> None:
        self.provider.delete(object_key)

    def url(self, object_key: str, expires: int = 3600) -> str:
        return self.provider.url(object_key, expires)

    @property
    def provider_name(self) -> str:
        return self.provider.name


def get_storage() -> StorageService:
    return current_app.extensions["storage"]
