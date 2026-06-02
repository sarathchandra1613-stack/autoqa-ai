"""Generate Playwright tests locally without an LLM."""

import re


def _slugify(text: str, max_len: int = 40) -> str:
    slug = re.sub(r"[^a-z0-9]+", "-", text.lower()).strip("-")
    return (slug[:max_len] or "requirement").strip("-")


def _detect_login_context(requirement: str) -> dict:
    lower = requirement.lower()
    return {
        "is_login": any(k in lower for k in ("login", "sign in", "signin", "log in")),
        "has_email": any(k in lower for k in ("email", "username", "user name")),
        "has_password": "password" in lower,
        "has_invalid": any(k in lower for k in ("invalid", "wrong", "error", "fail")),
        "has_success_redirect": any(
            k in lower for k in ("dashboard", "redirect", "home", "success", "welcome")
        ),
    }


def generate_offline_script(requirement: str) -> str:
    ctx = _detect_login_context(requirement)
    suite = _slugify(requirement.split("\n")[0])
    base_url = "https://example.com"

    if ctx["is_login"] or (ctx["has_email"] and ctx["has_password"]):
        return _login_template(
            requirement=requirement,
            suite=suite,
            base_url=base_url,
            include_invalid=ctx["has_invalid"],
            include_redirect=ctx["has_success_redirect"],
        )

    return _generic_template(requirement=requirement, suite=suite, base_url=base_url)


def _login_template(
    requirement: str,
    suite: str,
    base_url: str,
    include_invalid: bool,
    include_redirect: bool,
) -> str:
    comment = "\n".join(f"// {line}" for line in requirement.strip().splitlines()[:8])
    tests = []

    if include_invalid:
        tests.append(
            """
  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.getByLabel(/email|username/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrong-password');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();

    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible();
  });
"""
        )

    success_assert = (
        "await expect(page).toHaveURL(/dashboard/i);"
        if include_redirect
        else "await expect(page.getByText(/welcome|dashboard|success/i)).toBeVisible();"
    )

    tests.append(
        f"""
  test('successful login', async ({{ page }}) => {{
    await page.goto(`${{BASE_URL}}/login`);

    await page.getByLabel(/email|username/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password');
    await page.getByRole('button', {{ name: /sign in|log in|login/i }}).click();

    {success_assert}
  }});
"""
    )

    tests_block = "\n".join(tests)

    return f"""// Auto-generated offline Playwright test (no API)
// Requirement:
{comment}

import {{ test, expect }} from '@playwright/test';

const BASE_URL = '{base_url}';

test.describe('{suite}', () => {{
{tests_block}
}});
"""


def _generic_template(requirement: str, suite: str, base_url: str) -> str:
    comment = "\n".join(f"// {line}" for line in requirement.strip().splitlines()[:8])
    return f"""// Auto-generated offline Playwright test (no API)
// Requirement:
{comment}

import {{ test, expect }} from '@playwright/test';

const BASE_URL = '{base_url}';

test.describe('{suite}', () => {{
  test('requirement smoke check', async ({{ page }}) => {{
    await page.goto(BASE_URL);
    await expect(page).toHaveTitle(/.+/);
  }});

  test('requirement validation placeholder', async ({{ page }}) => {{
    await page.goto(BASE_URL);
    // TODO: Replace selectors with real UI locators for your app.
    await expect(page.locator('body')).toBeVisible();
  }});
}});
"""
