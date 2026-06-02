// Auto-generated offline Playwright test (no API)
// Requirement:
// Login functionality

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://example.com';

test.describe('login-functionality', () => {

  test('successful login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.getByLabel(/email|username/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();

    await expect(page.getByText(/welcome|dashboard|success/i)).toBeVisible();
  });

});
