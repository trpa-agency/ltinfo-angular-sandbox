// The category menu beside a program page: every category with programs as a disclosure,
// the current category open, the current program marked, and the menu staying put while the
// reader moves between programs. On a narrow screen it folds into one disclosure above the page.
import type { Locator, Page } from '@playwright/test';

import { expect, test } from './support';

const menu = (page: Page): Locator => page.locator('app-program-nav');
const current = (page: Page): Locator => menu(page).locator('.pnav__link[aria-current="page"]');
const openGroups = (page: Page): Locator => menu(page).locator('.pnav__group[open] .pnav__group-name');

test.describe('Program page category menu', () => {
  test('opens on the current category with the current program marked', async ({ page }) => {
    await page.goto('/programs/41');
    await expect(menu(page).getByRole('navigation', { name: 'Monitoring programs by category' })).toBeVisible();
    await expect(current(page)).toHaveText('Ozone (O3)');
    await expect(openGroups(page)).toHaveText(['Air Quality']);
    // The other Air Quality programs are one click away.
    await expect(menu(page).locator('.pnav__group[open] .pnav__link')).toHaveCount(5);
    // Nine categories have programs; Recreation has none and is left out.
    await expect(menu(page).locator('.pnav__group')).toHaveCount(9);
    await expect(menu(page).locator('.pnav__group-name', { hasText: 'Recreation' })).toHaveCount(0);
  });

  test('moving to a sibling keeps the menu and marks the new program', async ({ page }) => {
    await page.goto('/programs/41');
    await expect(current(page)).toHaveText('Ozone (O3)');
    await menu(page).getByRole('link', { name: 'Carbon Monoxide (CO)' }).click();
    await expect(page).toHaveURL(/\/programs\/26$/);
    await expect(page.locator('h1').first()).toHaveText('Carbon Monoxide (CO)');
    await expect(current(page)).toHaveText('Carbon Monoxide (CO)');
    await expect(openGroups(page)).toHaveText(['Air Quality']);
  });

  test('another category opens in place and leads to its programs', async ({ page }) => {
    await page.goto('/programs/41');
    const noise = menu(page).locator('.pnav__group', { hasText: 'Noise' });
    await noise.locator('summary').click();
    await expect(noise).toHaveAttribute('open', '');
    await noise.getByRole('link', { name: 'Noise - Highways' }).click();
    await expect(page).toHaveURL(/\/programs\/65$/);
    await expect(current(page)).toHaveText('Noise - Highways');
  });

  test('the menu stays in view while the page scrolls', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/programs/39');
    await expect(current(page)).toHaveText('Tahoe Yellow Cress Monitoring');
    // Wait for the page to grow tall enough to scroll (the panels fill in after it loads).
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollHeight), { timeout: 30_000 }).toBeGreaterThan(3000);
    const before = await menu(page).evaluate((el) => el.getBoundingClientRect().top);
    await page.evaluate(() => window.scrollTo(0, 1500));
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(1000);
    const after = await menu(page).evaluate((el) => el.getBoundingClientRect().top);
    expect(after).toBeGreaterThanOrEqual(0);
    expect(after).toBeLessThan(before);
  });

  test.describe('at 375 px wide', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('folds into one closed disclosure above the page', async ({ page }) => {
      await page.goto('/programs/41');
      const fold = menu(page).locator('.pnav__fold');
      await expect(fold.locator('.pnav__fold-summary')).toHaveText(/Air Quality programs/);
      await expect(fold).not.toHaveAttribute('open', '');
      await fold.locator('.pnav__fold-summary').click();
      await expect(current(page)).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    });
  });
});
