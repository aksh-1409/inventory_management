import { test, expect } from '@playwright/test';

test.describe('Public navigation', () => {
  test('home page loads', async ({ page }) => {
    await page.goto('/');

    await expect(page).toHaveTitle(/StockPilot/);
    await expect(page.locator('body')).toBeVisible();
  });

  test('login page navigates from home', async ({ page }) => {
    await page.goto('/');

    const loginLink = page.getByRole('link', { name: /sign in/i });
    if (await loginLink.isVisible()) {
      await loginLink.click();
      await expect(page).toHaveURL(/\/auth\/login/);
    }
  });

  test('signup page loads directly', async ({ page }) => {
    await page.goto('/auth/signup');

    await expect(page.getByRole('heading', { name: /sign up/i })).toBeVisible();
  });
});
