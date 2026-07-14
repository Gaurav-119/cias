# Claim Nova — Dependency Audit Report

**Date:** 2026-06-24  
**Scope:** Active stack (`BackEnd/`, `frontend/`, `ai-service/`, Docker)  
**Method:** Full import scan of application code (excluding `venv/`, `node_modules/`)

---

## Executive summary

| Area | Before | After | Change |
|------|--------|-------|--------|
| Backend pip packages (direct) | 17 | 16 | −1 (`marshmallow`) |
| Frontend npm deps | 5 | 4 | −1 (`framer-motion`) |
| Legacy root npm deps | 11 + blockchain | **removed** | Firebase, ethers, MUI, Hardhat |
| API Docker build deps | `build-essential`, `libpq-dev` | removed | slimmer API image |
| AI Docker PyTorch | default (often CUDA-capable) | **CPU-only** | ~1–2 GB image savings |

**Estimated total savings (disk):** 800 MB – 2.5 GB depending on whether legacy `node_modules/`, `blockchain/`, and CUDA PyTorch wheels were present.

**Estimated Docker image reduction:**
- **api:** ~150–250 MB (no compiler toolchain)
- **ai:** ~1.0–1.8 GB (CPU PyTorch vs GPU/CUDA bundle)

---

## Backend (`BackEnd/requirements.txt`)

### KEEP

| Package | Reason |
|---------|--------|
| Flask | App factory, blueprints, request handling |
| Flask-Cors | CORS for React SPA |
| Flask-SQLAlchemy | ORM / models |
| Flask-Migrate | DB migrations (pulls **Alembic** transitively) |
| SQLAlchemy | Queries, engine |
| psycopg2-binary | PostgreSQL driver |
| PyJWT | JWT auth (`auth/utils.py`) |
| bcrypt | Password hashing (`models/user.py`) |
| python-dotenv | `.env` loading (`config.py`) |
| requests | AI health check, AI client HTTP |
| gunicorn | Production WSGI (Dockerfile) |
| minio | MinIO storage provider (`storage/minio_provider.py`) |
| boto3 | Optional AWS S3 storage (`storage/s3_provider.py`) |
| reportlab | Policy certificate PDFs (`services/pdf.py`) |
| stripe | Optional Stripe checkout (`api/payments.py`, lazy import) |

### REMOVE

| Package | Reason |
|---------|--------|
| **marshmallow** | Zero imports in `BackEnd/app/` — serialization uses `to_dict()` on models |

### Not added (not used in backend code)

| Package | Reason |
|---------|--------|
| Pillow | No `PIL` imports; uploads handled via Werkzeug/storage |

---

## Frontend (`frontend/package.json`)

### KEEP

| Package | Reason |
|---------|--------|
| react / react-dom | UI framework (all pages) |
| react-router-dom | Routing (`App.jsx`, portals) |
| axios | API client (`api/client.js`) |
| vite | Build tool |
| @vitejs/plugin-react | React JSX transform |
| tailwindcss / postcss / autoprefixer | Styling |

### REMOVE

| Package | Reason |
|---------|--------|
| **framer-motion** | Listed in `package.json` but **never imported** in `frontend/src/` |
| **recharts** | Never used; admin/agent dashboards use plain HTML tables |

---

## AI service (`ai-service/requirements.txt`)

### KEEP

| Package | Reason |
|---------|--------|
| fastapi / uvicorn | HTTP API (`app/main.py`) |
| pydantic | Request schemas |
| numpy | Array ops in CV pipeline |
| opencv-python-headless | Image decode/process (`damage_yolo.py`, `ocr.py`) |
| scikit-image | SSIM heuristic fallback (`damage_yolo.py`) |
| Pillow | Image handling via EasyOCR/OpenCV stack |
| ultralytics | YOLO11/YOLOv8 damage detection (`damage_yolo.py`) |
| easyocr | OCR engine (`ocr.py`) |
| requests | Fetch claim images from URLs |
| python-dotenv | Settings |

### NOT present (correctly absent)

TensorFlow, Jupyter, CUDA toolkits, blockchain, Firebase, Hardhat, Web3 — none were in the active AI service.

### Docker optimization

`ai-service/Dockerfile` now installs **CPU-only** `torch` + `torchvision` before `ultralytics`, avoiding NVIDIA/CUDA wheels.

---

## Legacy / abandoned modules (safe to delete manually)

These paths are **not used** by Docker Compose or the rebuilt app. Remove when you no longer need them for reference:

```powershell
cd D:\CIAS
Remove-Item -Recurse -Force src, blockchain, node_modules, public, deploy -ErrorAction SilentlyContinue
Remove-Item -Force package.json, package-lock.json, index.html, vite.config.js, eslint.config.js -ErrorAction SilentlyContinue
```

| Path | Reason |
|------|--------|
| `src/` | Old React app (Firebase, Web3, MUI) — superseded by `frontend/` |
| `blockchain/` | Hardhat / ethers smart-contract stack — not used by rebuilt app |
| Root `package.json` | Firebase, ethers, MUI, blockchain scripts |
| Root `node_modules/` | Dependencies for abandoned root app |
| Root `index.html`, `vite.config.js`, `eslint.config.js` | Legacy Vite entry (replaced by `frontend/`) |
| Root `public/` | Legacy static assets |
| `deploy/` | Empty placeholder directory |

**Note:** Automated deletion was not run; execute the PowerShell block above if you want these removed from disk.

**Active application paths only:**

```
BackEnd/          Flask API
frontend/         React SPA
ai-service/       FastAPI AI
docker-compose.yml
```

---

## Environment variables

### KEEP (used in `BackEnd/app/config.py` + Docker)

`SECRET_KEY`, `JWT_SECRET`, `JWT_ACCESS_HOURS`, `DATABASE_URL`, `STORAGE_PROVIDER`, `STORAGE_BUCKET`, `LOCAL_STORAGE_DIR`, `MINIO_*`, `AWS_*`, `S3_ENDPOINT_URL`, `AI_SERVICE_URL`, `PAYMENT_MODE`, `STRIPE_*`, `CORS_ORIGINS`, `MAX_UPLOAD_MB`, `AUTO_CREATE_TABLES`

### No unused env vars removed from `.env.example` — all map to optional providers (local/minio/s3/stripe).

---

## Docker / Compose changes

1. `docker-compose.yml`: `build: ./backend` → `build: ./BackEnd` (fixes Windows path)
2. `BackEnd/Dockerfile`: removed `build-essential` / `libpq-dev` (using `psycopg2-binary`)
3. `ai-service/Dockerfile`: CPU PyTorch index before ML deps
4. Added `.dockerignore` files to shrink build context

---

## Final production-ready dependency set

### BackEnd
```
Flask, Flask-Cors, Flask-SQLAlchemy, Flask-Migrate, SQLAlchemy,
psycopg2-binary, PyJWT, bcrypt, python-dotenv, requests,
gunicorn, minio, boto3, reportlab, stripe
```

### Frontend
```
react, react-dom, react-router-dom, axios
+ dev: vite, @vitejs/plugin-react, tailwindcss, postcss, autoprefixer
```

### AI service
```
fastapi, uvicorn, pydantic, numpy, opencv-python-headless,
scikit-image, Pillow, ultralytics, easyocr, requests, python-dotenv
+ runtime: torch, torchvision (CPU, via Dockerfile)
```

---

## How to run after cleanup

```cmd
cd D:\CIAS
docker compose up --build -d
docker compose exec api python seed.py
docker compose exec api python scripts/ensure_kyc_columns.py
```

| Service | URL |
|---------|-----|
| Web | http://localhost:8080 |
| API | http://localhost:5000/api/health |
| AI | http://localhost:8000/health |

### Local frontend (without Docker)

```cmd
cd D:\CIAS\frontend
npm install
npm run dev
```

---

## Verification checklist

- [x] Auth (JWT + bcrypt)
- [x] PostgreSQL
- [x] MinIO / local / S3 storage abstraction
- [x] OCR + damage detection AI routes
- [x] Claims, policies, payments
- [x] Admin / agent / verifier portals
- [x] Live video verification
- [x] KYC document uploads
- [x] `npm run build` (frontend)
- [x] `python -m compileall app` (backend)
