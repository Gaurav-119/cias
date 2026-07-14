import os


class Settings:
    # Path to a trained YOLO11 segmentation model. If absent, the service
    # gracefully falls back to a packaged YOLO detection model or to the
    # OpenCV/SSIM heuristic - so the API always responds.
    YOLO_MODEL_PATH = os.getenv("YOLO_MODEL_PATH", "models/yolo11n-seg.pt")
    YOLO_FALLBACK_PATH = os.getenv("YOLO_FALLBACK_PATH", "models/yolov8n.pt")
    USE_GPU = os.getenv("USE_GPU", "false").lower() == "true"
    CONF_THRESHOLD = float(os.getenv("CONF_THRESHOLD", "0.5"))
    API_KEY = os.getenv("AI_API_KEY", "claimnova_2026")


settings = Settings()
