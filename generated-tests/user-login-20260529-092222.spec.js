// Auto-generated offline Playwright test (no API)
// Requirement:
// User login invalid error

import { test, expect } from '@playwright/test';

const BASE_URL = 'https://example.com';

test.describe('user-login-invalid-error', () => {

  test('shows error on invalid credentials', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.getByLabel(/email|username/i).fill('wrong@example.com');
    await page.getByLabel(/password/i).fill('wrong-password');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();

    await expect(page.getByText(/invalid|incorrect|error/i)).toBeVisible();
  }),


  test('successful login', async ({ page }) => {
    await page.goto(`${BASE_URL}/login`);

    await page.getByLabel(/email|username/i).fill('test@example.com');
    await page.getByLabel(/password/i).fill('password');
    await page.getByRole('button', { name: /sign in|log in|login/i }).click();

    await expect(page.getByText(/welcome|dashboard|success/i)).toBeVisible();
  }),

});
