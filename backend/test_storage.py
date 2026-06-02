from datetime import datetime, timezone
from pathlib import Path

from offline_generator import _slugify

ROOT_DIR = Path(__file__).resolve().parent.parent
TESTS_DIR = ROOT_DIR / "generated-tests"


def ensure_tests_dir() -> Path:
    TESTS_DIR.mkdir(parents=True, exist_ok=True)
    return TESTS_DIR


def save_script(script: str, requirement: str) -> str:
    """Save script to generated-tests/. Returns path relative to repo root."""
    ensure_tests_dir()
    slug = _slugify(requirement.split("\n")[0])
    timestamp = datetime.now(timezone.utc).strftime("%Y%m%d-%H%M%S")
    filename = f"{slug}-{timestamp}.spec.js"
    path = TESTS_DIR / filename
    path.write_text(script, encoding="utf-8")
    return f"generated-tests/{filename}"


def list_saved_tests() -> list[dict]:
    ensure_tests_dir()
    files = sorted(TESTS_DIR.glob("*.spec.js"), key=lambda p: p.stat().st_mtime, reverse=True)
    return [
        {
            "filename": f.name,
            "path": f"generated-tests/{f.name}",
            "size_bytes": f.stat().st_size,
            "modified_at": datetime.fromtimestamp(
                f.stat().st_mtime, tz=timezone.utc
            ).isoformat(),
        }
        for f in files
    ]


def resolve_test_path(filename: str) -> Path:
    if "/" in filename or "\\" in filename or filename.startswith(".."):
        raise ValueError("Invalid filename")
    path = TESTS_DIR / filename
    if not path.exists():
        raise FileNotFoundError(f"Test not found: {filename}")
    return path
