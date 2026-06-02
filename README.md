# AutoQA AI

AI-powered self-healing automation testing framework.

## Planned Features

- AI-generated test cases
- Playwright script generation
- Automated test execution
- Self-healing locators
- Smart regression testing

## Phase 1: Generate Playwright scripts

Requirement → FastAPI → (Offline template or Gemini) → Generated Playwright Script

## Phase 2 (Current): Save + run tests

Requirement → generate → save to `generated-tests/` → run with Playwright

## Backend Setup

```bash
pip install -r requirements.txt
```

Create `backend/.env` (copy from `backend/.env.example`).

**Offline mode (default, no API cost):** `GENERATION_MODE=offline`

**Gemini mode:** `GENERATION_MODE=gemini` + `GEMINI_API_KEY`

Run the API:

```bash
cd backend
uvicorn main:app --reload
```

Open Swagger: http://127.0.0.1:8000/docs

### API endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | Health check |
| POST | `/generate-test` | Generate script (`save: true` by default) |
| GET | `/tests` | List saved scripts |
| POST | `/run-test` | Run a saved script by filename |

### Phase 2 flow (PowerShell)

```powershell
# 1) Generate + save
$body = @{ text = "User login: invalid shows error. Valid redirects dashboard."; save = $true } | ConvertTo-Json -Compress
$res = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/generate-test" -ContentType "application/json" -Body $body
$res.saved_path

# 2) List saved tests
Invoke-RestMethod -Uri "http://127.0.0.1:8000/tests"

# 3) Run a saved test (install Playwright once — see below)
$run = @{ filename = ($res.saved_path -replace '^generated-tests/', '') } | ConvertTo-Json -Compress
Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:8000/run-test" -ContentType "application/json" -Body $run
```

### Playwright setup (one time, repo root)

```bash
npm install
npx playwright install
```

Generated tests use `https://example.com` by default, so runs may **fail** until you point `BASE_URL` at your real app — that still validates the pipeline (generate → save → run → report).

HTML report after a run: `playwright-report/index.html`
