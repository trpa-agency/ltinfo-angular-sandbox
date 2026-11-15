// The topic switcher on a program page: a button beside the breadcrumb that says how many
// programs share the category and opens the list of them. It replaced the rail that listed
// every category beside every page, so the page itself has the full width.
import type { Locator, Page } from '@playwright/test';

import { expect, seed, test } from './support';

const switcher = (page: Page): Locator => page.locator('app-program-nav');
const button = (page: Page): Locator => switcher(page).locator('summary');
const panel = (page: Page): Locator => switcher(page).locator('.pnav__panel');
const current = (page: Page): Locator => switcher(page).locator('.pnav__link[aria-current="page"]');

test.describe('Program page topic switcher', () => {
  test('says how many programs are in the topic, and stays closed until asked', async ({ page }) => {
    await page.goto('/programs/41');
    await expect(switcher(page).getByRole('navigation', { name: 'Programs in this topic' })).toBeVisible();
    await expect(button(page)).toHaveText(`${seed.airQualityPrograms} programs in this topic`);
    await expect(panel(page)).toBeHidden();
  });

  test('opens the programs of the current category, with the current one marked', async ({ page }) => {
    await page.goto('/programs/41');
    await button(page).click();
    await expect(panel(page)).toBeVisible();
    await expect(panel(page).locator('.pnav__topic')).toHaveText('Air Quality');
    await expect(panel(page).locator('.pnav__link')).toHaveCount(seed.airQualityPrograms);
    await expect(current(page)).toHaveText('Ozone (O3)');
    // The way out to every other topic is the home page, not a list of 14 categories here.
    await expect(panel(page).getByRole('link', { name: 'All topics' })).toHaveAttribute('href', /\/#categories$/);
  });

  test('moving to a sibling closes the list and marks the new program', async ({ page }) => {
    await page.goto('/programs/41');
    await button(page).click();
    await panel(page).getByRole('link', { name: 'Carbon Monoxide (CO)' }).click();
    await expect(page).toHaveURL(/\/programs\/26$/);
    await expect(page.locator('h1').first()).toHaveText('Carbon Monoxide (CO)');
    await expect(panel(page)).toBeHidden();
    await button(page).click();
    await expect(current(page)).toHaveText('Carbon Monoxide (CO)');
  });

  test('works from the keyboard: Enter opens it, and the links are in the tab order', async ({ page }) => {
    await page.goto('/programs/41');
    await button(page).focus();
    await page.keyboard.press('Enter');
    await expect(panel(page)).toBeVisible();
    await page.keyboard.press('Tab');
    await expect(panel(page).locator('.pnav__link').first()).toBeFocused();
  });

  test('the page has no rail: the program takes the full width of the page', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/programs/41');
    await expect(page.locator('h1').first()).toHaveText('Ozone (O3)');
    await expect(page.locator('.pd__rail')).toHaveCount(0);
    const main = await page.locator('.pd__main').evaluate((el) => el.getBoundingClientRect().width);
    const program = await page.locator('.program').evaluate((el) => el.getBoundingClientRect().width);
    expect(program).toBe(main);
  });

  test.describe('at 375 px wide', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('the button takes the row, and the open list fits the screen', async ({ page }) => {
      await page.goto('/programs/41');
      await button(page).click();
      await expect(current(page)).toBeVisible();
      const box = await panel(page).boundingBox();
      expect(box!.x).toBeGreaterThanOrEqual(0);
      expect(box!.x + box!.width).toBeLessThanOrEqual(375);
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
    });
  });
});
