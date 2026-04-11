import { test, expect } from '@playwright/test';

test.describe('Critical public journeys', () => {
  test('homepage shell renders for anonymous visitors', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveTitle(/Governada/i);
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('legacy discover route redirects into DRep discovery', async ({ page }) => {
    await page.goto('/discover', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/filter=dreps/, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('DRep discovery can open a profile', async ({ page }) => {
    await page.goto('/?filter=dreps', { waitUntil: 'domcontentloaded' });

    const drepLink = page.locator('a[href^="/drep/"]').first();
    const hasLink = await drepLink.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasLink, 'No DRep links found on the discovery route');

    await drepLink.click();
    await expect(page).toHaveURL(/\/drep\//, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('proposal discovery can open proposal detail', async ({ page }) => {
    await page.goto('/?filter=proposals', { waitUntil: 'domcontentloaded' });

    const proposalLink = page.locator('a[href^="/proposal/"], a[href^="/g/proposal/"]').first();
    const hasLink = await proposalLink.isVisible({ timeout: 10_000 }).catch(() => false);
    test.skip(!hasLink, 'No proposal links found on the discovery route');

    await proposalLink.click();
    await expect(page).toHaveURL(/\/(proposal|g\/proposal)\//, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });
  });

  test('quick match progresses beyond entry', async ({ page }) => {
    await page.goto('/match', { waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/match$/, { timeout: 30_000 });
    await expect(page.locator('#main-content')).toBeVisible({ timeout: 15_000 });

    const senecaDialog = page.getByRole('dialog', { name: /Seneca conversation/i });
    const openSenecaButton = page.getByRole('button', { name: /Open Seneca/i });
    const routeStartButton = page.getByRole('button', { name: /^Start Match$/i });
    const startMatchButton = page
      .getByRole('button', {
        name: /Start Match|Find my match|Find my representative|Where do I fit\?|Find my place/i,
      })
      .first();
    const firstChoice = page.getByRole('button', { name: /^Protect it$/i });
    const secondChoice = page.getByRole('button', { name: /^Stability first$/i });

    await expect
      .poll(
        async () => {
          if (await firstChoice.isVisible().catch(() => false)) return 'matching';
          if (await senecaDialog.isVisible().catch(() => false)) return 'dialog';
          if (await routeStartButton.isVisible().catch(() => false)) return 'route-cta';
          if (await openSenecaButton.isVisible().catch(() => false)) return 'closed';
          return 'loading';
        },
        { timeout: 20_000 },
      )
      .not.toBe('loading');

    if (!(await firstChoice.isVisible().catch(() => false))) {
      if (await routeStartButton.isVisible().catch(() => false)) {
        await routeStartButton.click();
      } else if (!(await senecaDialog.isVisible().catch(() => false))) {
        await openSenecaButton.click();
        await expect(senecaDialog).toBeVisible({ timeout: 10_000 });
      }

      if (await startMatchButton.isVisible().catch(() => false)) {
        await startMatchButton.click();
      }
    }

    await expect(
      page.getByText(/Find Your Match|A few questions to find your governance match/i).first(),
    ).toBeVisible({
      timeout: 15_000,
    });
    await expect(firstChoice).toBeVisible({ timeout: 15_000 });

    await firstChoice.click();
    await expect(secondChoice).toBeVisible({ timeout: 10_000 });
  });

  test('health endpoint reports operational status', async ({ request }) => {
    const response = await request.get('/api/health');
    expect(response.ok()).toBeTruthy();

    const body = await response.json();
    expect(body).toHaveProperty('status');
    expect(body.status).not.toBe('error');
  });
});
