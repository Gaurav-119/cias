from __future__ import annotations

from .base import StorageProvider, StoredObject


class S3StorageProvider(StorageProvider):
    """AWS S3 (or any S3-compatible) provider for future cloud deployment."""

    name = "s3"

    def __init__(self, bucket, region, access_key, secret_key, endpoint_url=""):
        super().__init__(bucket)
        import boto3

        kwargs = {"region_name": region}
        if access_key and secret_key:
            kwargs["aws_access_key_id"] = access_key
            kwargs["aws_secret_access_key"] = secret_key
        if endpoint_url:
            kwargs["endpoint_url"] = endpoint_url
        self.client = boto3.client("s3", **kwargs)
        try:
            self.client.head_bucket(Bucket=bucket)
        except Exception:
            self.client.create_bucket(Bucket=bucket)

    def upload(self, data: bytes, object_key: str, content_type: str) -> StoredObject:
        self.client.put_object(
            Bucket=self.bucket, Key=object_key, Body=data, ContentType=content_type
        )
        return StoredObject(self.bucket, object_key, len(data), content_type, self.name)

    def download(self, object_key: str) -> bytes:
        obj = self.client.get_object(Bucket=self.bucket, Key=object_key)
        return obj["Body"].read()

    def delete(self, object_key: str) -> None:
        self.client.delete_object(Bucket=self.bucket, Key=object_key)

    def url(self, object_key: str, expires: int = 3600) -> str:
        return self.client.generate_presigned_url(
            "get_object",
            Params={"Bucket": self.bucket, "Key": object_key},
            ExpiresIn=expires,
        )
