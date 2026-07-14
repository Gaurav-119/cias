# CIAS — Claim Nova Insurance Automation System

AI-powered motor insurance platform for vehicle registration, policy purchase, live verification, and automated damage claim assessment.

## Features

- **Customer portal** — register vehicles, buy policies, pay premiums, submit claims, track status
- **AI damage assessment** — YOLO panel/damage detection with annotated preview and repair cost estimation
- **Verifier portal** — live video verification, document preview, checklist-based approval
- **Agent portal** — manage providers, pricing rules, and add-ons
- **Admin portal** — users, vehicles, policies, claims, vehicle master, repair cost master
- **Payments** — Stripe test mode (or offline record mode)
- **File storage** — MinIO / S3 / local via storage abstraction (no binaries in PostgreSQL)

## Tech stack

| Layer | Technology |
|-------|------------|
| Frontend | React 18, Tailwind CSS, Vite |
| Core API | Flask, SQLAlchemy, Flask-Migrate |
| Auth | JWT + bcrypt, RBAC (user / agent / verifier / admin) |
| Database | PostgreSQL |
| Object storage | MinIO (default in Docker) or AWS S3 / local |
| AI service | FastAPI, YOLO damage detection, OCR |
| Payments | Stripe (test mode) |
| Deployment | Docker Compose |

## Project structure

```
CIAS/
├── BackEnd/           Flask API (claims, policies, vehicles, auth, admin)
├── frontend/          React SPA (customer, admin, agent, verifier portals)
├── ai-service/        FastAPI AI microservice (/predict, OCR)
├── scripts/           Utility scripts
├── docker-compose.yml
├── .env.example       Root env template for Docker Compose
└── README.md
```

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (recommended)
- Or: Node.js 20+, Python 3.12+, PostgreSQL, MinIO (for local dev without Docker)
- Optional: Git for cloning and contributing

## Quick start (Docker)

```bash
# 1. Clone
git clone https://github.com/Gaurav-119/cias.git
cd cias

# 2. Environment (optional — defaults work for local demo)
cp .env.example .env
# Edit .env if you need Stripe keys or custom secrets

# 3. Start core services (API, DB, MinIO, web portals)
docker compose up -d --build

# 4. Seed demo data (run once after API is healthy)
docker compose exec api python seed.py
```

### With AI damage detection (optional, larger image)

```bash
docker compose --profile ai up -d --build
```

Set `AI_SERVICE_URL` in `.env` if your AI service runs outside Docker (e.g. `http://host.docker.internal:8000`).

## Portal URLs

| Portal | URL |
|--------|-----|
| Customer | http://localhost:8080 |
| Admin | http://localhost:8081 |
| Verifier | http://localhost:8082 |
| Agent | http://localhost:8083 |
| API health | http://localhost:5000/api/health |
| AI service | http://localhost:8000/docs |
| MinIO console | http://localhost:9001 |

## Demo logins (after `seed.py`)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@claimnova.com | Admin@123 |
| Agent | agent@claimnova.com | Agent@123 |
| Verifier | verifier@claimnova.com | Verifier@123 |
| Customer | user@claimnova.com | User@123 |

## Environment variables

Copy templates before running locally:

```bash
cp .env.example .env
cp BackEnd/.env.example BackEnd/.env
cp frontend/.env.example frontend/.env
cp ai-service/.env.example ai-service/.env
```

**Never commit** `.env` files. Use `.env.example` as reference only.

Key variables:

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `SECRET_KEY` / `JWT_SECRET` | App and token signing |
| `STORAGE_PROVIDER` | `minio`, `s3`, or `local` |
| `AI_SERVICE_URL` | AI `/predict` endpoint base URL |
| `AI_API_KEY` | API key for AI service |
| `STRIPE_SECRET_KEY` | Stripe secret (test keys for demo) |
| `VITE_API_URL` | Frontend → API URL |

## Local development (without Docker)

### Backend

```bash
cd BackEnd
python -m venv venv
venv\Scripts\activate          # Windows
pip install -r requirements.txt
copy .env.example .env         # edit DATABASE_URL, etc.
python seed.py
python wsgi.py                 # http://localhost:5000
```

### Frontend

```bash
cd frontend
npm install
copy .env.example .env
npm run dev                    # http://localhost:5173
```

### AI service

```bash
cd ai-service
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

Place YOLO weights in `ai-service/models/` (e.g. `yolo11n-seg.pt`). The service falls back gracefully if weights are missing.

## Claim workflow

1. Customer registers and logs in
2. Registers vehicle + uploads documents and photos
3. Verifier reviews via live video + document preview
4. Customer buys policy and pays premium (Stripe test)
5. Customer submits claim with damage images
6. AI analyzes damage → assessment page with repair costs and claim amount
7. Admin / verifier can review and decide

## Security notes

- Change `SECRET_KEY` and `JWT_SECRET` before any public deployment
- Use Stripe **test** keys for development only
- Do not push `.env` files or real API keys to GitHub
- Rotate any keys that were ever committed by mistake

## License

Academic / portfolio project. Add a license file if you open-source it formally.

## Author

Claim Nova — CIAS (Crypto Insurance & Automotive Services)
