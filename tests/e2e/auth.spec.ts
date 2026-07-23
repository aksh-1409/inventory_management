import { test, expect } from '@playwright/test';

test.describe('Authentication pages', () => {
  test('login page renders correctly', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page).toHaveTitle(/StockPilot/);
    await expect(page.getByRole('heading', { name: /sign in/i })).toBeVisible();

    const emailInput = page.getByLabel(/email/i);
    const passwordInput = page.getByLabel(/password/i);
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();

    await expect(page.getByRole('button', { name: /sign in/i })).toBeVisible();
  });

  test('login page shows demo accounts', async ({ page }) => {
    await page.goto('/auth/login');

    await expect(page.getByText(/sarah/i)).toBeVisible();
    await expect(page.getByText(/mike/i)).toBeVisible();
  });

  test('login page has forgot password link', async ({ page }) => {
    await page.goto('/auth/login');

    const forgotLink = page.getByRole('link', { name: /forgot/i });
    await expect(forgotLink).toBeVisible();
    await expect(forgotLink).toHaveAttribute('href', '/auth/forgot-password');
  });

  test('login page has signup link', async ({ page }) => {
    await page.goto('/auth/login');

    const signupLink = page.getByRole('link', { name: /sign up/i });
    await expect(signupLink).toBeVisible();
    await expect(signupLink).toHaveAttribute('href', '/auth/signup');
  });
});
