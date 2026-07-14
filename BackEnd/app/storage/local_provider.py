from __future__ import annotations

import os
from pathlib import Path

from .base import StorageProvider, StoredObject


class LocalStorageProvider(StorageProvider):
    """Stores objects on a mounted volume. The volume can live on any host
    or be backed by a network share, so the app itself never depends on a
    specific laptop/HDD path - only on the configured directory."""

    name = "local"

    def __init__(self, bucket: str, base_dir: str, public_base: str = "/api/files"):
        super().__init__(bucket)
        self.base_dir = str(Path(base_dir).resolve())
        self.public_base = public_base
        os.makedirs(os.path.join(self.base_dir, self.bucket), exist_ok=True)

    def _path(self, object_key: str) -> str:
        full = os.path.join(self.base_dir, self.bucket, object_key)
        os.makedirs(os.path.dirname(full), exist_ok=True)
        return full

    def upload(self, data: bytes, object_key: str, content_type: str) -> StoredObject:
        with open(self._path(object_key), "wb") as fh:
            fh.write(data)
        return StoredObject(self.bucket, object_key, len(data), content_type, self.name)

    def download(self, object_key: str) -> bytes:
        with open(self._path(object_key), "rb") as fh:
            return fh.read()

    def delete(self, object_key: str) -> None:
        try:
            os.remove(self._path(object_key))
        except FileNotFoundError:
            pass

    def url(self, object_key: str, expires: int = 3600) -> str:
        # Served back through the Flask /api/files/<key> proxy route.
        return f"{self.public_base}/{object_key}"
