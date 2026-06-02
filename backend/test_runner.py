import shutil
import subprocess
from pathlib import Path

from test_storage import ROOT_DIR, resolve_test_path


def _find_npx() -> str | None:
    return shutil.which("npx") or shutil.which("npx.cmd")


def run_playwright_test(filename: str, timeout_s: int = 120) -> dict:
    npx = _find_npx()
    if not npx:
        raise RuntimeError(
            "Node.js/npx not found. Install Node.js, then from repo root run: npm install && npx playwright install"
        )

    test_path = resolve_test_path(filename)
    rel_path = test_path.relative_to(ROOT_DIR)

    try:
        result = subprocess.run(
            [npx, "playwright", "test", str(rel_path).replace("\\", "/")],
            cwd=ROOT_DIR,
            capture_output=True,
            text=True,
            timeout=timeout_s,
        )
    except subprocess.TimeoutExpired as e:
        raise RuntimeError(f"Playwright run timed out after {timeout_s}s") from e

    status = "passed" if result.returncode == 0 else "failed"
    return {
        "filename": filename,
        "status": status,
        "exit_code": result.returncode,
        "stdout": result.stdout,
        "stderr": result.stderr,
        "report_dir": "playwright-report" if status == "failed" else None,
    }
