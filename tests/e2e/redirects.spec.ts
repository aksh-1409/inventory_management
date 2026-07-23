import { test, expect } from '@playwright/test';

test.describe('Auth redirects', () => {
  test('unauthenticated access to dashboard redirects to login', async ({ page }) => {
    const response = await page.goto('/dashboard');

    await expect(page).toHaveURL(/\/auth\/login/);
    expect(response?.status()).toBeLessThan(400);
  });

  test('unauthenticated access to dashboard includes callbackUrl', async ({ page }) => {
    await page.goto('/dashboard');

    const callbackUrl = page.url();
    expect(callbackUrl).toContain('callbackUrl=' + encodeURIComponent('/dashboard'));
  });

  test('unauthenticated access to products redirects to login', async ({ page }) => {
    await page.goto('/dashboard/products');

    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('unauthenticated access to inventory redirects to login', async ({ page }) => {
    await page.goto('/dashboard/inventory');

    await expect(page).toHaveURL(/\/auth\/login/);
  });

  test('public home page is accessible without auth', async ({ page }) => {
    const response = await page.goto('/');

    expect(response?.status()).toBeLessThan(400);
    await expect(page.locator('body')).toBeVisible();
  });
});
