# Claim Nova / CIAS — Rebuilt

AI-powered motor insurance claim automation system, rebuilt on a portable,
machine-independent stack. The original design (layout, colors `#00C1D4` /
navy `#002147`, Inter typography, workflows) is preserved; the implementation
was migrated to the requested stack.

## Tech stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + **Tailwind CSS** + Vite |
| Core API | **Flask** + SQLAlchemy + Flask-Migrate |
| Auth | **JWT** (PyJWT) + **bcrypt** password hashing |
| Authorization | **RBAC**: user / agent / verifier / admin |
| Database | **PostgreSQL** |
| Object storage | **Storage abstraction**: Local / **MinIO** / AWS S3 |
| AI service | **FastAPI** + YOLO11-seg (graceful YOLOv8 / OpenCV fallback) + OCR |
| Payments | Stripe checkout or offline "record" mode |
| Deployment | Docker Compose (web, api, ai, db, minio) |

## Folder structure

```
.
├── backend/                 Flask core insurance API
│   ├── app/
│   │   ├── __init__.py       app factory
│   │   ├── config.py         all settings from env (machine independent)
│   │   ├── models/           SQLAlchemy models
│   │   ├── auth/             JWT + bcrypt + RBAC (roles_required)
│   │   ├── api/              vehicles, policies, claims, payments, ocr, ai, admin, agent, files
│   │   ├── services/         premium/IDV math, ai_client, audit
│   │   └── storage/          storage_service + local/minio/s3 providers
│   ├── seed.py               demo users + catalog
│   └── Dockerfile
├── ai-service/              FastAPI AI micro-service
│   ├── app/services/         damage_yolo, ocr, estimator
│   └── models/               drop yolo11n-seg.pt / yolov8n.pt here
├── frontend/               React + Tailwind SPA
│   └── src/pages/            Home, Login, Register, Dashboard, CarRegistration,
│                             PolicySelection, Payment, Claim, admin/, agent/, verifier/
└── docker-compose.yml
```

> The original code (`src/`, `BackEnd/`, `blockchain/`) is kept untouched as
> reference and is not used by the rebuilt app.

## File storage (never on the local laptop, never binaries in PostgreSQL)

All uploads go through `backend/app/storage/storage_service.py`. The provider
is chosen by the `STORAGE_PROVIDER` env var (`local` | `minio` | `s3`) with no
code changes. Only the object key + metadata are written to the `files` table
in PostgreSQL; the binary lives in MinIO/S3 (or a mounted volume for `local`).

## Quick start — Docker (recommended)

```bash
cp .env.example .env            # optional: set secrets / Stripe
docker compose up --build
# seed demo data once the api container is healthy:
docker compose exec api python seed.py
```

Then open:

| Service | URL |
|---------|-----|
| Web app | http://localhost:8080 |
| Core API | http://localhost:5000/api/health |
| AI service | http://localhost:8000/health |
| MinIO console | http://localhost:9001 (minioadmin / minioadmin) |

### Demo logins (after seeding)

| Role | Email | Password |
|------|-------|----------|
| admin | admin@claimnova.com | Admin@123 |
| agent | agent@claimnova.com | Agent@123 |
| verifier | verifier@claimnova.com | Verifier@123 |
| user | user@claimnova.com | User@123 |

## Quick start — local dev (no Docker)

1. **PostgreSQL + MinIO** running locally (or set `STORAGE_PROVIDER=local`).
2. **Backend**
   ```bash
   cd backend
   python -m venv venv && venv\Scripts\activate     # Windows
   pip install -r requirements.txt
   copy .env.example .env                            # edit DATABASE_URL etc.
   python seed.py
   python wsgi.py                                    # http://localhost:5000
   ```
3. **AI service**
   ```bash
   cd ai-service
   pip install -r requirements.txt
   uvicorn app.main:app --reload --port 8000
   ```
4. **Frontend**
   ```bash
   cd frontend
   npm install
   copy .env.example .env                            # VITE_API_URL=http://localhost:5000
   npm run dev                                        # http://localhost:5173
   ```

## Recovered modules (not in the blackbook, restored from the original)

| Module | Frontend route | Backend |
|--------|----------------|---------|
| Purchased Policies Dashboard / Policy History | `/policies` | `GET /api/policies` |
| Policy Details Page | `/policies/:id` | `GET /api/policies/<id>` (enriched) |
| Policy Certificate (printable document) | `/policies/:id/certificate` | `GET /api/policies/<id>/certificate` |
| Policy PDF Generation | "Download PDF" button | `GET /api/policies/<id>/certificate.pdf` (reportlab; report archived to MinIO/S3) |
| Claim Status Tracking | `/claims` | `GET /api/claims` |
| Claim Details View (with timeline) | `/claims/:id` | `GET /api/claims/<id>` (+ `events`) |

Claim status changes are recorded in the `claim_events` table on submission,
AI analysis and admin decisions, powering the tracking timeline. The printable
certificate uses print CSS (nav/footer hidden) plus an identical server-side
PDF rendering.

## Workflow (preserved from the original)

1. Register / login (JWT) → role-based redirect.
2. Register a vehicle + upload multi-angle photos (stored via storage layer).
3. Choose a policy → IDV + premium computed from the blackbook math model.
4. Pay the premium (Stripe or record mode) → policy activates.
5. File a claim + upload damage images → FastAPI AI returns severity, cost,
   fraud flag.
6. Verifier approves/rejects vehicles; Admin manages users/cars/policies/
   claims/payments; Agent manages providers/pricing/add-ons/base prices.

## AI model

Drop a trained `yolo11n-seg.pt` into `ai-service/models/` for full YOLO11
segmentation. If absent, the service automatically falls back to the bundled
`yolov8n.pt` detector, and then to an OpenCV/SSIM heuristic — so the endpoint
always responds.

## Switching storage backends

```env
# Local volume
STORAGE_PROVIDER=local
LOCAL_STORAGE_DIR=/data/storage

# MinIO (default in compose)
STORAGE_PROVIDER=minio
MINIO_ENDPOINT=minio:9000

# AWS S3 (cloud)
STORAGE_PROVIDER=s3
AWS_REGION=ap-south-1
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
```

No application code changes are required for any of these.
