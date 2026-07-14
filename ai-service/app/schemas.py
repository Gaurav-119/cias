from typing import Optional

from pydantic import BaseModel


class AnalyzeRequest(BaseModel):
    image_urls: list[str]
    registration_urls: list[str] = []
    market_value: Optional[float] = None


class OCRRequest(BaseModel):
    image_url: str
