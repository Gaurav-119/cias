from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
import cv2
import numpy as np

from .config import settings
from .schemas import AnalyzeRequest, OCRRequest
from .services import estimator
from .services.damage_yolo import detector, fetch_image
from .services.ocr import read_text

app = FastAPI(title="CIAS AI Service", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "healthy", "service": "CIAS AI", "model_mode": detector.mode}


@app.post("/predict")
async def predict(
    file: UploadFile = File(...),
    x_api_key: str | None = Header(default=None, alias="x-api-key"),
):
    if x_api_key != settings.API_KEY:
        raise HTTPException(status_code=401, detail="Invalid API key")
    if not file.content_type or not file.content_type.startswith("image/"):
        raise HTTPException(status_code=400, detail="Invalid image file")

    raw = await file.read()
    if not raw:
        raise HTTPException(status_code=400, detail="Empty file")

    arr = np.frombuffer(raw, dtype=np.uint8)
    image = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not decode image")

    return detector.predict_payload(image)


@app.post("/analyze-claim")
def analyze_claim(req: AnalyzeRequest):
    if not req.image_urls:
        raise HTTPException(status_code=400, detail="image_urls is required")

    damage_images = [img for u in req.image_urls if (img := fetch_image(u)) is not None]
    if not damage_images:
        raise HTTPException(status_code=400, detail="No readable damage images")

    reg_images = [img for u in req.registration_urls if (img := fetch_image(u)) is not None]

    detections: list[dict] = []
    for img in damage_images:
        found = detector.detect(img)
        if not found:
            # Fall back to comparison / single-image heuristic
            found = (
                detector.heuristic_compare(img, reg_images)
                if reg_images else detector.heuristic_single(img)
            )
        detections.extend(found)

    assessment = estimator.aggregate(detections, req.market_value)

    # Simple fraud signal: very low confidence but non-trivial cost.
    fraud = bool(
        assessment["total_repair_cost"] > 15000
        and detections
        and (sum(d["confidence"] for d in detections) / len(detections)) < 0.6
    )
    assessment["fraud_flag"] = fraud
    assessment["recommendation"] = (
        "approve" if assessment["claim_valid"] and not fraud else "review_required"
    )
    assessment["model_mode"] = detector.mode
    return assessment


@app.post("/ocr")
def ocr(req: OCRRequest):
    image = fetch_image(req.image_url)
    if image is None:
        raise HTTPException(status_code=400, detail="Could not read image")
    return read_text(image)
