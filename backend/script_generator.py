import os
from dotenv import load_dotenv
from google import genai
from google.genai import types

from offline_generator import generate_offline_script

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
load_dotenv(os.path.join(BASE_DIR, ".env"))

_SYSTEM_PROMPT = """You are an expert QA automation engineer.
Generate Playwright tests that are stable, readable, and runnable.
Only output code. Do not include explanations or markdown fences.
"""


class ProviderError(RuntimeError):
    def __init__(self, message: str, status_code: int = 500):
        super().__init__(message)
        self.status_code = status_code


def _generation_mode() -> str:
    return os.getenv("GENERATION_MODE", "offline").strip().lower()


def _fallback_on_quota() -> bool:
    return os.getenv("GEMINI_FALLBACK_OFFLINE", "true").strip().lower() in (
        "1",
        "true",
        "yes",
    )


def _build_prompt(requirement: str) -> str:
    return f"""
Generate ONE Playwright test file in JavaScript for the following requirement:

{requirement}

Constraints:
- Output must be a complete runnable test file using @playwright/test
- Use test.describe when multiple tests make sense
- Include at least 2 tests (happy path + one negative/validation path) when applicable
- Prefer role/text selectors (getByRole/getByLabel) over brittle CSS selectors
- Include clear assertions with expect(...)
- Avoid hard-coded sleeps; use Playwright auto-waits or expect(...).toBeVisible(), etc.
- Use placeholder base URL 'https://example.com' if URL is not provided
""".strip()


def _generate_gemini(requirement: str) -> str:
    api_key = os.getenv("GEMINI_API_KEY") or os.getenv("GOOGLE_API_KEY")
    if not api_key:
        raise RuntimeError(
            "GEMINI_API_KEY is not set. Add it to backend/.env or use GENERATION_MODE=offline."
        )

    prompt = _build_prompt(requirement)
    http_timeout_s = float(os.getenv("GEMINI_HTTP_TIMEOUT_S", "30"))
    client = genai.Client(
        api_key=api_key,
        http_options=types.HttpOptions(client_args={"timeout": http_timeout_s}),
    )

    try:
        resp = client.models.generate_content(
            model=os.getenv("GEMINI_MODEL", "gemini-2.0-flash"),
            contents=prompt,
            config=types.GenerateContentConfig(
                temperature=float(os.getenv("GEMINI_TEMPERATURE", "0.2")),
                max_output_tokens=int(os.getenv("GEMINI_MAX_OUTPUT_TOKENS", "1200")),
                system_instruction=_SYSTEM_PROMPT,
            ),
        )
    except Exception as e:
        msg = str(e)
        if "429" in msg or "RESOURCE_EXHAUSTED" in msg:
            raise ProviderError(f"Gemini quota/rate limit: {msg}", status_code=429) from e
        raise ProviderError(f"Gemini request failed: {msg}", status_code=502) from e

    content = (resp.text or "").strip()
    if not content:
        raise RuntimeError("Gemini returned empty content.")
    return content


def generate_test_script(requirement: str) -> tuple[str, str]:
    """Returns (script, mode) where mode is 'offline' or 'gemini'."""
    mode = _generation_mode()

    if mode == "offline":
        return generate_offline_script(requirement), "offline"

    if mode != "gemini":
        raise RuntimeError(
            f"Unknown GENERATION_MODE='{mode}'. Use 'offline' or 'gemini'."
        )

    try:
        return _generate_gemini(requirement), "gemini"
    except ProviderError as e:
        if e.status_code == 429 and _fallback_on_quota():
            return generate_offline_script(requirement), "offline"
        raise
