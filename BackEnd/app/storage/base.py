from __future__ import annotations

import uuid
from abc import ABC, abstractmethod
from dataclasses import dataclass


@dataclass
class StoredObject:
    """Metadata returned by every provider after an upload.

    Only this metadata is persisted in PostgreSQL - never the binary.
    """

    bucket: str
    object_key: str
    size: int
    content_type: str
    provider: str


class StorageProvider(ABC):
    """Common interface implemented by Local, MinIO and S3 providers."""

    name: str = "base"

    def __init__(self, bucket: str):
        self.bucket = bucket

    @staticmethod
    def build_key(folder: str, filename: str) -> str:
        ext = ""
        if "." in filename:
            ext = "." + filename.rsplit(".", 1)[1].lower()
        return f"{folder.strip('/')}/{uuid.uuid4().hex}{ext}"

    @abstractmethod
    def upload(self, data: bytes, object_key: str, content_type: str) -> StoredObject:
        ...

    @abstractmethod
    def download(self, object_key: str) -> bytes:
        ...

    @abstractmethod
    def delete(self, object_key: str) -> None:
        ...

    @abstractmethod
    def url(self, object_key: str, expires: int = 3600) -> str:
        ...
