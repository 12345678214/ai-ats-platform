# Shortlist — AI-Powered Job & Applicant Tracking Platform

A full-stack ATS where candidates apply with a resume, a Python service parses and scores every applicant against the job, and recruiters work a ranked pipeline. Three roles (candidate, recruiter, admin), each with its own dashboard, routes and permissions.

**Stack:** React 18 · Tailwind CSS 4 · React Router · Axios · Recharts · Node.js · Express · PostgreSQL · Prisma · Python (Flask, scikit-learn, pdfplumber) · JWT + RBAC

```
┌──────────────┐  /api   ┌───────────────────┐  SQL   ┌────────────┐
│ React client │ ──────▶ │ Express API (4000)│ ─────▶ │ PostgreSQL │
│  (Vite 5173) │         │ controllers →     │        └────────────┘
└──────────────┘         │ services → Prisma │
                         │                   │  HTTP  ┌───────────────────┐
                         │                   │ ─────▶ │ Python AI service │
                         └───────────────────┘        │ (Flask, 8000)     │
                                  │                   │ parse · extract · │
                                  ▼                   │ match · rank      │
                          uploads/resumes/            └───────────────────┘
```

## What it does

**Candidate** — register, build a profile (with a live completion meter), upload a PDF/DOCX resume that is parsed for skills/education/experience, search and filter jobs, save jobs, apply, track every application on a timeline, see interview invitations, get notifications, withdraw an application.

**Recruiter** — company profile, create/edit/pause/close jobs (skills are extracted from the description automatically if you don't list them), a ranked applicant table and a drag-and-drop pipeline board, per-applicant AI breakdown (matched / related / missing skills), private notes, shortlist/reject, interview scheduling, analytics (funnel, applications per day, score distribution, common skill gaps, view→apply conversion).

**Admin** — platform stats and growth charts, user management with instant deactivation, company verification/disabling, job moderation (flag/hide/restore/delete), read-only application oversight.

### The workflow

```
Candidate registers → completes profile → uploads resume (parsed by Python)
  → applies → application created, recruiter notified
  → AI match score generated (skills / experience / education / text)
  → recruiter reviews ranked applicants → shortlists or rejects
  → schedules interview → candidate is notified
  → candidate tracks status + timeline
```

All of this is exercised by the automated tests below.

## AI matching

The AI service (`ai-service/`) is real code, not a mock. No score is hard-coded.

**Resume parsing** (`parser.py`): text extraction from PDF (pdfplumber, pypdf fallback) and DOCX (python-docx, including tables) → section detection → skills (a ~120-skill taxonomy with aliases such as `nodejs`/`Node.js`, case-sensitive rules for ambiguous words like *React* or *Go*) → education (degree level, field, institution, year) → experience (date ranges, merged so overlapping jobs aren't double counted, plus phrases like "4 years of experience") → contact details.

**Job parsing**: skills mentioned after "nice to have / preferred / bonus" are marked optional; minimum years come from phrases like "3-5 years".

**Scoring** (`matcher.py`), 0–100:

| Part | Weight | How |
| --- | --- | --- |
| Skills | 60% | Required skills count 2×, optional 1×. A skill is covered if the candidate has it *or something that implies it* (Next.js ⇒ React ⇒ JavaScript). Same-family skills earn 40% (MySQL for a PostgreSQL job). |
| Experience | 20% | Candidate years ÷ job minimum, capped at 100%. |
| Education | 10% | Highest degree vs. the level the posting asks for. |
| Text similarity | 10% | TF-IDF (1–2-grams) cosine similarity between the job text and resume text. |

If a job lists no skills, weights shift to experience/education/text. The result also contains `matchedSkills`, `partialSkills`, `missingSkills`, `extraSkills` and a plain-English `summary`, all stored in `MatchResult` and shown to recruiters.

Candidate skills = skills on their profile **plus** skills found in the resume text, so an under-filled profile doesn't hurt a strong resume.

Design choices worth knowing: scores are visible only to recruiters (never candidates); scoring runs in the background after apply so the candidate gets an instant response, and the recruiter UI polls until it lands; if the AI service is down, applications still succeed and the match is marked `FAILED` with a **Retry** action.

**Limitations (honest ones):** the taxonomy is hand-curated (skills outside it are matched by exact name only); scanned/image-only PDFs aren't OCR'd and are rejected with a clear message; this is deterministic keyword + TF-IDF matching, not an LLM or embedding model — it's explainable and fast, and `matcher.py` is the single place to swap in embeddings later.

## Project structure

```
ats-platform/
├── client/                    React app (Vite)
│   └── src/
│       ├── components/{ui,layout,jobs}   design system, shell, job board
│       ├── context/                      auth + toast providers
│       ├── lib/                          api client, formatters, hooks
│       └── pages/{candidate,recruiter,admin,shared}
├── server/                    Express API
│   ├── prisma/                schema.prisma, migrations/, seed.js
│   ├── src/{config,middleware,validators,routes,controllers,services,utils}
│   └── tests/e2e.mjs          API workflow test (32 checks)
├── ai-service/                Python service
│   ├── app/{main,parser,matcher,taxonomy}.py
│   └── tests/test_ai.py       13 unit tests
├── docs/API.md                REST + AI-service reference
└── docker-compose.yml
```

Requests flow `route → validation (zod) → controller → service → Prisma`. Controllers stay thin; business rules live in services.

## Database

PostgreSQL via Prisma — 16 tables with foreign keys, unique constraints, indexes on every hot query path, timestamps and enums.

```
User ─┬─ CandidateProfile ─┬─ CandidateSkill ── Skill ── JobSkill ── Job ── Company
      │                    ├─ Resume                                  │  └─ RecruiterProfile ─ User
      │                    ├─ SavedJob ───────────────────────────────┤
      │                    └─ Application ────────────────────────────┘
      │                         ├─ MatchResult        (1:1, AI output)
      │                         ├─ Interview
      │                         ├─ RecruiterNote
      │                         └─ ApplicationStatusHistory
      └─ Notification
```

Roles are a Prisma enum (`CANDIDATE | RECRUITER | ADMIN`) on `User`. `Application` is unique per `(jobId, candidateId)`.

## Getting started

**Prerequisites:** Node 18+, Python 3.10+, PostgreSQL 14+.

### 1. Database

```bash
createdb ats_dev                       # or use any Postgres you like
# optional dedicated user:
# psql -c "CREATE USER ats WITH PASSWORD 'ats' CREATEDB;" -c "ALTER DATABASE ats_dev OWNER TO ats;"
```

### 2. Python AI service (start this first — the seed script uses it)

```bash
cd ai-service
python -m venv .venv && source .venv/bin/activate      # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
python run.py                                          # http://localhost:8000/health
```

### 3. API

```bash
cd server
cp .env.example .env            # then edit DATABASE_URL and JWT_SECRET
npm install                     # also runs `prisma generate`
npx prisma migrate deploy       # creates all tables
npm run db:seed                 # demo data: real PDF resumes, parsed + scored
npm run dev                     # http://localhost:4000/api/health
```

`npm run db:seed -- --reset` wipes and reseeds.

### 4. Client

```bash
cd client
npm install
npm run dev                     # http://localhost:5173  (proxies /api → :4000)
```

### Or with Docker

```bash
docker compose up --build
docker compose exec server npm run db:seed
# app on http://localhost:8080, API on :4000
```

> The Docker files were written to the same standards as the rest but were **not run** in the environment this project was built in (no Docker daemon). Everything else in this README was run; if `docker compose` needs a tweak on your machine, the manual steps above are the reference path.

## Sample accounts (created by the seed)

| Role | Email | Password |
| --- | --- | --- |
| Admin | `admin@ats.dev` | `Admin@12345` |
| Recruiter (Northwind Labs) | `recruiter@ats.dev` | `Password@123` |
| Recruiter (Brightpath Health) | `recruiter2@ats.dev` | `Password@123` |
| Candidate (fully populated) | `candidate@ats.dev` | `Password@123` |
| More candidates | `priya@`, `rohan@`, `sara@`, `liam@`, `meera@`, `diego@`, `hannah@ats.dev` | `Password@123` |

The login page also has one-click demo buttons.

## Environment variables

**server/.env**

| Variable | Default | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | – (required) | PostgreSQL connection string |
| `JWT_SECRET` | – (required) | Signing key; ≥32 chars enforced in production |
| `JWT_EXPIRES_IN` | `7d` | Token lifetime |
| `PORT` | `4000` | API port |
| `CLIENT_URL` | `http://localhost:5173` | Allowed CORS origin(s), comma separated |
| `AI_SERVICE_URL` | `http://localhost:8000` | Python service |
| `AI_SERVICE_KEY` | – | Shared secret sent as `X-Service-Key` |
| `UPLOAD_DIR` | `uploads` | Where resumes are stored |
| `MAX_UPLOAD_MB` | `5` | Resume size limit |

**ai-service/.env** — `PORT` (8000), `AI_SERVICE_KEY` (must match the server's).
**client/.env** — `VITE_API_URL` (empty in dev; set to the API origin for a static deployment that isn't reverse-proxied).

## Testing

```bash
# Python: parser, taxonomy, matcher, API auth  (13 tests)
cd ai-service && pytest

# API workflow against live Postgres + AI service (32 checks; needs the seed for admin login)
cd server && npm run test:e2e

# Browser smoke test across every role (24 checks) — optional
pip install playwright && playwright install chromium
cd client && python e2e/ui_smoke.py
```

The API test covers: registration/validation/duplicate email, login failure modes, **role isolation** (candidate/recruiter/admin cross-access → 403), AI skill extraction on job creation, upload rejection (HTML, spoofed `.pdf`), PDF **and** DOCX parsing, profile completion, job search filters, save/unsave, apply (+ duplicate block), recruiter notification, **AI scores generated and the strong candidate outranks the weak one**, recruiter filtering, resume download authorization, shortlist → note → interview → candidate notifications, **candidates never see notes/scores**, recruiter-to-recruiter isolation, batch re-ranking, dashboards/analytics, job pause/delete rules, admin stats/moderation, instant account deactivation (including already-issued tokens).

## Security

- Passwords hashed with bcrypt (cost 12); login errors don't reveal whether an email exists
- JWT auth; every request re-checks the user so **deactivation applies immediately**
- RBAC middleware per route group; resource ownership enforced in services (other recruiters' data returns 404)
- zod validation on every body and query; Prisma parameterised queries
- Uploads: extension + MIME + magic-byte checks, random server-side filenames, size cap, downloads gated by ownership and served with `nosniff`
- `helmet`, CORS allow-list, rate limits (stricter on auth), JSON body limit
- Service-to-service key between API and AI service; internal error details hidden in production
- Candidate PII and recruiter notes are never exposed to the wrong role

## Deployment

A reasonable low-cost setup:

| Piece | Where | Notes |
| --- | --- | --- |
| PostgreSQL | Neon, Supabase, Railway or Render | Use the pooled/standard connection string as `DATABASE_URL` |
| AI service | Render / Railway / Fly (Docker) | `gunicorn -w 2 -b 0.0.0.0:$PORT app.main:app`; set `AI_SERVICE_KEY` |
| API | Render / Railway / Fly | Build `npm ci`; release command `npx prisma migrate deploy`; start `node src/server.js`. Set `NODE_ENV=production`, `JWT_SECRET` (≥32 chars), `DATABASE_URL`, `CLIENT_URL`, `AI_SERVICE_URL`, `AI_SERVICE_KEY`. **Attach a persistent disk and point `UPLOAD_DIR` at it** — resumes are stored on the filesystem. |
| Client | Vercel / Netlify / any static host | `npm run build` → `dist/`. Set `VITE_API_URL` to the API origin and add that origin's frontend URL to the API's `CLIENT_URL`. Add an SPA fallback rewrite to `index.html`. |

For multiple API instances, move resume storage to S3-compatible object storage (the only filesystem-coupled code is `middleware/upload.js`, `services/resume.service.js` and the download controller).

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| `Start the Python AI service first` when seeding | Run `python run.py` in `ai-service/` |
| Resume shows "Parsing failed" | AI service unreachable or the PDF is image-only; use **Retry** after starting the service |
| Scores stay "Scoring…" | Same cause — check `GET /api/health` shows `ai.ok: true`, then use **Re-run AI ranking** |
| `Can't reach database server` | Check `DATABASE_URL` and that Postgres is running |
| `Invalid service key` (401) in the AI log | `AI_SERVICE_KEY` differs between `server/.env` and `ai-service/.env` |
| Browser CORS error | Add your client origin to `CLIENT_URL` or use the Vite proxy |
| Fonts look plain | Google Fonts are loaded from the CDN; offline machines fall back to system fonts |

## Not included (by design)

Email delivery (notifications are in-app), OCR for scanned resumes, password reset by email, real-time websockets (notifications refresh every 30 s and applicant scores poll while pending), calendar integration for interviews.
