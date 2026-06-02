import os
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from script_generator import ProviderError, generate_test_script, _generation_mode
from test_runner import run_playwright_test
from test_storage import list_saved_tests, save_script, TESTS_DIR

app = FastAPI(title="AutoQA AI")

ROOT_DIR = Path(__file__).resolve().parent.parent
FRONTEND_DIR = ROOT_DIR / "frontend"
REPORT_DIR = ROOT_DIR / "playwright-report"

# Ensure report dir exists so StaticFiles mounting doesn't fail
REPORT_DIR.mkdir(parents=True, exist_ok=True)


class Requirement(BaseModel):
    text: str
    save: bool = True


class GeneratedScript(BaseModel):
    generated_script: str
    mode: str
    saved_path: str | None = None


class RunTestRequest(BaseModel):
    filename: str = Field(..., description="File name under generated-tests/, e.g. login-20260527.spec.js")


class RunTestResult(BaseModel):
    filename: str
    status: str
    exit_code: int
    stdout: str
    stderr: str
    report_dir: str | None = None


@app.get("/")
def home(request: Request):
    accept = request.headers.get("accept", "")
    if "text/html" in accept:
        index_path = FRONTEND_DIR / "index.html"
        if index_path.exists():
            return FileResponse(index_path)
    return {
        "message": "AutoQA AI Backend Running",
        "phase": 2,
        "mode": _generation_mode()
    }


@app.post("/generate-test", response_model=GeneratedScript)
def generate_test(requirement: Requirement) -> GeneratedScript:
    try:
        script, mode = generate_test_script(requirement.text)
        saved_path = save_script(script, requirement.text) if requirement.save else None
        return GeneratedScript(
            generated_script=script,
            mode=mode,
            saved_path=saved_path,
        )
    except ProviderError as e:
        raise HTTPException(status_code=e.status_code, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/tests")
def get_tests():
    return {"tests": list_saved_tests()}


@app.post("/run-test", response_model=RunTestResult)
def run_test(body: RunTestRequest) -> RunTestResult:
    try:
        result = run_playwright_test(body.filename)
        return RunTestResult(**result)
    except FileNotFoundError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")
app.mount("/report", StaticFiles(directory=str(REPORT_DIR)), name="report")
app.mount("/generated-tests", StaticFiles(directory=str(TESTS_DIR)), name="generated-tests")
