from __future__ import annotations

import io

from .base import StorageProvider, StoredObject


class MinioStorageProvider(StorageProvider):
    """Object storage backed by MinIO (S3 compatible)."""

    name = "minio"

    def __init__(self, bucket, endpoint, access_key, secret_key,
                 secure=False, public_endpoint=""):
        super().__init__(bucket)
        from minio import Minio

        self.public_endpoint = public_endpoint
        self.client = Minio(
            endpoint,
            access_key=access_key,
            secret_key=secret_key,
            secure=secure,
        )
        if not self.client.bucket_exists(bucket):
            self.client.make_bucket(bucket)

    def upload(self, data: bytes, object_key: str, content_type: str) -> StoredObject:
        self.client.put_object(
            self.bucket,
            object_key,
            io.BytesIO(data),
            length=len(data),
            content_type=content_type,
        )
        return StoredObject(self.bucket, object_key, len(data), content_type, self.name)

    def download(self, object_key: str) -> bytes:
        resp = self.client.get_object(self.bucket, object_key)
        try:
            return resp.read()
        finally:
            resp.close()
            resp.release_conn()

    def delete(self, object_key: str) -> None:
        self.client.remove_object(self.bucket, object_key)

    def url(self, object_key: str, expires: int = 3600) -> str:
        from datetime import timedelta

        link = self.client.presigned_get_object(
            self.bucket, object_key, expires=timedelta(seconds=expires)
        )
        if self.public_endpoint:
            # Rewrite internal docker host to a browser-reachable host
            from urllib.parse import urlparse

            parsed = urlparse(link)
            link = f"{self.public_endpoint.rstrip('/')}{parsed.path}?{parsed.query}"
        return link
