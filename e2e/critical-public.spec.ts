import { test, expect } from '@playwright/test';

test.describe('Critical public journeys', () => {
  test('homepage shell renders for anonymous visitors', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Governada/i);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('discovery state loads from the home route', async ({ page }) => {
    await page.goto('/?filter=dreps', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/filter=dreps/);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('legacy discover route redirects into discovery state', async ({ page }) => {
    await page.goto('/discover', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/filter=dreps/, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('legacy proposals route redirects into proposal discovery', async ({ page }) => {
    await page.goto('/proposals', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/filter=proposals/, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('durable match route loads on its dedicated path', async ({ page }) => {
    await page.goto('/match', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/match$/, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('health endpoint reports operational status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body.status).not.toBe('error');
  });
});
