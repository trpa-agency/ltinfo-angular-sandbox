// The site profile on the map template: a click on a site or area, on the map or in the list,
// opens a card built from the site's own records. The card reads the TRPA map service, a live
// server outside the sandbox, so every wait is for something the reader sees, within
// PANEL_TIMEOUT_MS.
//
// Hooks the card exposes on its host (app-site-profile): data-state (idle, loading, ready,
// error), data-mode, and data-records (the rows behind it). Beside a wide map the profile opens
// in the list column (.sites-panel__rail) in the list's place; under a narrow map it docks under
// the map. The record chart sets data-drawn on app-profile-chart once Vega has drawn it.
import fs from 'node:fs';

import type { Locator, Page } from '@playwright/test';

import { PANEL_TIMEOUT_MS, expect, test } from './support';

const programUrl = (id: number): string => `/programs/${id}`;
const panel = (page: Page): Locator => page.locator('app-sites-panel');
const profile = (page: Page): Locator => page.locator('app-site-profile');
const rows = (page: Page): Locator => page.locator('.site-list__row:not([disabled])');
const rowNamed = (page: Page, name: string): Locator => rows(page).filter({ hasText: name }).first();
const rail = (page: Page): Locator => page.locator('.sites-panel__rail');
const list = (page: Page): Locator => page.locator('app-site-list');

async function openProgram(page: Page, id: number): Promise<void> {
  await page.goto(programUrl(id));
  await expect(panel(page)).toHaveAttribute('data-state', 'ready', { timeout: PANEL_TIMEOUT_MS });
}

/** Waits until the card has its record (or has given up on it). */
async function profileSettled(page: Page): Promise<void> {
  await expect(profile(page)).toHaveAttribute('data-state', /^(ready|error)$/, { timeout: PANEL_TIMEOUT_MS });
}

/**
 * Clicks a program marker or area that is really under the pointer, nearest the map center,
 * after the Home button has brought every feature into view. Program points are drawn with a
 * 1.5 px white outline and areas at 0.55 fill opacity, which tells them from the overlays.
 */
async function clickFeature(page: Page): Promise<void> {
  await page.locator('.sites-map__canvas').evaluate((el) => el.scrollIntoView({ block: 'center' }));
  await page.locator('.sites-map__home-button').click();
  await page.waitForTimeout(700);
  const point = await page.evaluate(() => {
    const canvas = document.querySelector('.sites-map__canvas')!.getBoundingClientRect();
    const cx = canvas.left + canvas.width / 2;
    const cy = canvas.top + canvas.height / 2;
    const paths = [...document.querySelectorAll('.sites-map path.leaflet-interactive')].filter(
      (p) => p.getAttribute('stroke-width') === '1.5' || p.getAttribute('fill-opacity') === '0.55',
    );
    let best: { x: number; y: number; d: number } | null = null;
    for (const p of paths) {
      const r = p.getBoundingClientRect();
      for (let i = 1; i < 6; i++) {
        for (let j = 1; j < 6; j++) {
          const x = r.left + (r.width * i) / 6;
          const y = r.top + (r.height * j) / 6;
          if (x < canvas.left + 60 || x > canvas.right - 60 || y < canvas.top + 60 || y > canvas.bottom - 60) continue;
          if (document.elementFromPoint(x, y) !== p) continue;
          const d = (x - cx) ** 2 + (y - cy) ** 2;
          if (!best || d < best.d) best = { x, y, d };
        }
      }
    }
    return best;
  });
  expect(point, 'a program feature under the pointer').not.toBeNull();
  await page.mouse.click(point!.x, point!.y);
}

test.describe('Site profile', () => {
  // Every test opens a live panel and then a profile, each allowed PANEL_TIMEOUT_MS.
  test.describe.configure({ timeout: PANEL_TIMEOUT_MS * 3 });

  test('opens from a list row with the site name and its record chart', async ({ page }) => {
    await openProgram(page, 39);
    await rowNamed(page, 'Baldwin Beach').click();
    await profileSettled(page);
    await expect(profile(page)).toHaveAttribute('data-state', 'ready');
    // It takes the list's place in the column, and the map beside it stays clear.
    await expect(rail(page).locator('app-site-profile')).toHaveCount(1);
    await expect(list(page)).toBeHidden();
    await expect(page.locator('.leaflet-popup')).toHaveCount(0);
    await expect(profile(page).locator('.profile__name')).toHaveText('Baldwin Beach');
    // Opened from the list, the card takes focus.
    await expect(profile(page).locator('.profile__name')).toBeFocused();
    await expect(profile(page).getByRole('img', { name: /^Stem count at Baldwin Beach, \d{4} to \d{4}$/ })).toBeVisible();
    await expect(profile(page).locator('app-profile-chart')).toHaveAttribute('data-drawn', 'true', { timeout: PANEL_TIMEOUT_MS });
    await expect(profile(page).locator('.profile__facts').first()).toContainText(/Record\s*\d{4} to \d{4}, \d+ surveys/);
    // Back to List returns to the list with the row focused.
    await rail(page).locator('.sites-panel__back').click();
    await expect(list(page)).toBeVisible();
    await expect(rowNamed(page, 'Baldwin Beach')).toBeFocused();
  });

  test('opens from a marker on the map in the list column', async ({ page }) => {
    await openProgram(page, 39);
    await clickFeature(page);
    await profileSettled(page);
    const name = (await profile(page).locator('.profile__name').textContent())?.trim() ?? '';
    expect(name).not.toBe('');
    await expect(rail(page).locator('app-site-profile')).toHaveCount(1);
    // One way out in the column: Back to List. The card's own close button is for the docked form.
    await expect(rail(page).locator('.sites-panel__back')).toBeVisible();
    await expect(profile(page).locator('.profile__close')).toBeHidden();
    await expect(profile(page).locator('app-profile-chart')).toHaveAttribute('data-drawn', 'true', { timeout: PANEL_TIMEOUT_MS });
  });

  test('places a noise site among the others and against its limit', async ({ page }) => {
    await openProgram(page, 65);
    await rowNamed(page, 'Hwy 50 near Round Hill').click();
    await profileSettled(page);
    const context = profile(page).locator('.profile__context');
    await expect(context).toContainText(/(\d+(st|nd|rd|th) highest|Highest|Lowest|lowest) of \d+ sites in \d{4}\./);
    await expect(context).toContainText(/(Above|Below) the \d+ dBA limit/);
  });

  test('shows the SEZ indicator table for the evaluation year', async ({ page }) => {
    await openProgram(page, 49);
    await rows(page).first().click();
    await profileSettled(page);
    const table = profile(page).locator('table.profile__table');
    await expect(table).toBeVisible();
    await expect(table.locator('thead')).toContainText('Indicator');
    expect(await table.locator('tbody tr').count()).toBeGreaterThan(0);
    await expect(profile(page).locator('.profile__context')).toContainText(/Rated [A-D]/);
  });

  test('shows the aquatic invasive plants status strip with control actions', async ({ page }) => {
    await openProgram(page, 14);
    await rowNamed(page, 'Camp Richardson').click();
    await profileSettled(page);
    await expect(profile(page).locator('.profile__strip-cell')).toHaveCount(7);
    await expect(profile(page).locator('.profile__strip-cell').first()).toContainText('2018');
    await expect(profile(page).locator('.profile__actions-list')).toContainText('2024');
  });

  test('Escape closes the profile and returns focus to the row', async ({ page }) => {
    await openProgram(page, 39);
    const row = rowNamed(page, 'Baldwin Beach');
    await row.click();
    await profileSettled(page);
    await expect(profile(page).locator('.profile__name')).toBeFocused();
    await page.keyboard.press('Escape');
    await expect(profile(page)).toHaveAttribute('data-state', 'idle');
    await expect(list(page)).toBeVisible();
    await expect(row).toBeFocused();
    await expect(row).not.toHaveAttribute('aria-current', 'true');
  });

  test('shows the SEZ unit photos from the map service, with a larger view', async ({ page }) => {
    await openProgram(page, 49);
    await rowNamed(page, 'Rosewood Creek - middle 2').click();
    await profileSettled(page);
    const tiles = profile(page).locator('.profile__photo');
    // Six attached photos: four tiles, the last marked +2.
    await expect(tiles).toHaveCount(4, { timeout: PANEL_TIMEOUT_MS });
    await expect(tiles.nth(3)).toContainText('+2');
    await expect(profile(page).locator('.profile__section-title', { hasText: 'Photos' })).toContainText('2019');
    const first = tiles.first().locator('img');
    await expect.poll(() => first.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: PANEL_TIMEOUT_MS }).toBe(true);

    await tiles.first().click();
    const dialog = profile(page).locator('dialog.profile__lightbox');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toHaveText(/photo 1 of 6\s*$/);
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('h2')).toHaveText(/photo 2 of 6\s*$/);
    await expect(dialog).toContainText('2019 evaluation');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('shows a scenic corridor unit its viewpoint panoramas as a carousel', async ({ page }) => {
    // Emerald Bay roadway unit 3: 11 viewpoints, six with a photo. The panoramas run 10 MB and
    // more as stored, so every photo shown is a copy the map service scales down.
    await openProgram(page, 59);
    await rows(page).filter({ hasText: 'Emerald Bay' }).filter({ hasText: 'Roadway' }).click();
    await profileSettled(page);
    await expect(profile(page).locator('.profile__section-title', { hasText: 'Viewpoints' })).toBeVisible({ timeout: PANEL_TIMEOUT_MS });
    const carousel = profile(page).locator('.profile__carousel');
    const slide = carousel.locator('.profile__photo--wide img');
    await expect(slide).toHaveAttribute('src', /\/MapServer\/24\/\d+\/attachments\/\d+\?w=1200$/);
    await expect(carousel.locator('.profile__photo img')).toHaveCount(1);
    await expect(carousel).toHaveAttribute('data-slide-state', 'ready', { timeout: PANEL_TIMEOUT_MS });
    expect(await slide.evaluate((el: HTMLImageElement) => el.naturalWidth)).toBeGreaterThan(0);
    await expect(carousel.locator('.profile__photo-label')).toHaveText('Viewpoint 3.2-roadway');
    await expect(carousel.locator('.profile__photo-count')).toHaveText('1 of 6');

    // Next steps through the viewpoints in natural order (3.11 after 3.7) and wraps around.
    const first = await slide.getAttribute('src');
    await carousel.locator('.profile__carousel-next').click();
    await expect(carousel.locator('.profile__photo-label')).toHaveText('Viewpoint 3.3-roadway');
    await expect(carousel.locator('.profile__photo-count')).toHaveText('2 of 6');
    await expect(slide).not.toHaveAttribute('src', first!);
    await expect(carousel).toHaveAttribute('data-slide-state', 'ready', { timeout: PANEL_TIMEOUT_MS });
    await carousel.locator('.profile__carousel-prev').click();
    await carousel.locator('.profile__carousel-prev').click();
    await expect(carousel.locator('.profile__photo-label')).toHaveText('Viewpoint 3.11-roadway');
    await expect(carousel.locator('.profile__photo-count')).toHaveText('6 of 6');

    // The slide opens the larger view at the same photo; the file as stored is a link there.
    await carousel.locator('.profile__photo--wide').click();
    const dialog = profile(page).locator('dialog.profile__lightbox');
    await expect(dialog).toBeVisible();
    await expect(dialog.locator('h2')).toHaveText(/Emerald Bay, Viewpoint 3\.11-roadway, 6 of 6\s*$/);
    await expect(dialog.locator('.profile__lightbox-img')).toHaveAttribute('src', /\/attachments\/\d+\?w=2400$/);
    await expect(dialog.locator('.profile__lightbox-original')).toHaveAttribute('href', /\/attachments\/\d+$/);
    await expect(dialog.locator('.profile__lightbox-original')).toHaveText(/^Full size, \d+(\.\d)? MB$/);
    await page.keyboard.press('ArrowRight');
    await expect(dialog.locator('h2')).toHaveText(/Viewpoint 3\.2-roadway, 1 of 6\s*$/);
    await expect(dialog).toContainText('TRPA scenic monitoring viewpoint photos');
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
  });

  test('shows a scenic corridor unit a card per evaluation year in place of the chart', async ({ page }) => {
    await openProgram(page, 59);
    await rows(page).filter({ hasText: 'Emerald Bay' }).filter({ hasText: 'Roadway' }).click();
    await profileSettled(page);
    await expect(profile(page).locator('app-profile-chart')).toHaveCount(0);
    const cards = profile(page).locator('.profile__year');
    // Nine evaluations, 1982 to 2023, every one in attainment.
    expect(await cards.count()).toBeGreaterThanOrEqual(9);
    await expect(cards.first()).toContainText('1982');
    await expect(cards.first()).toContainText('Attainment');
    // The color is the map's color for the status.
    expect(await cards.first().evaluate((el) => (el as HTMLElement).style.getPropertyValue('--profile-status'))).toBe('#188c16');
    // The latest year is open to begin with.
    const detail = profile(page).locator('.profile__year-detail');
    await expect(cards.last()).toHaveAttribute('aria-pressed', 'true');
    await expect(detail.locator('.profile__year-head')).toContainText(/\d{4}\s*Attainment/);

    // A year with comments shows its rating, its component scores, and the comments.
    await cards.filter({ hasText: '2019' }).click();
    await expect(cards.filter({ hasText: '2019' })).toHaveAttribute('aria-pressed', 'true');
    await expect(detail.locator('.profile__year-head')).toContainText('2019');
    await expect(detail.locator('.profile__facts')).toContainText(/Scenic rating\s*26\.5/);
    await expect(detail.locator('.profile__facts')).toContainText(/Lake views\s*5/);
    await expect(detail.locator('.profile__year-comments')).toContainText('A new driveway is visible near Spring Creek Rd');
    // A year without comments says so.
    await cards.filter({ hasText: '1982' }).click();
    await expect(detail.locator('.profile__year-comments')).toHaveText('No comments recorded for 1982.');
  });

  test('a scenic viewpoint on the map opens a popup with its photo', async ({ page }) => {
    await openProgram(page, 59);
    await page.locator('.sites-map__canvas').evaluate((el) => el.scrollIntoView({ block: 'center' }));
    await page.locator('.sites-map__home-button').click();
    await page.waitForTimeout(700);
    // Viewpoints are drawn over the corridors, so the pointer reaches them: radius 5, 0.9 opacity.
    const point = await page.evaluate(() => {
      const canvas = document.querySelector('.sites-map__canvas')!.getBoundingClientRect();
      for (const p of document.querySelectorAll('.sites-map path.leaflet-interactive[fill-opacity="0.9"]')) {
        const r = p.getBoundingClientRect();
        const x = r.left + r.width / 2;
        const y = r.top + r.height / 2;
        if (x < canvas.left + 80 || x > canvas.right - 80 || y < canvas.top + 120 || y > canvas.bottom - 60) continue;
        if (document.elementFromPoint(x, y) === p) return { x, y };
      }
      return null;
    });
    expect(point, 'a viewpoint under the pointer').not.toBeNull();
    await page.mouse.click(point!.x, point!.y);
    const popup = page.locator('.leaflet-popup .sites-popup');
    await expect(popup).toBeVisible();
    await expect(popup.locator('.sites-popup__pill')).toHaveText('Scenic viewpoints');
    // The corridor's profile does not open for a click on a viewpoint.
    await expect(profile(page)).toHaveAttribute('data-state', 'idle');
    // 332 of the 396 viewpoints carry a photo; the rest say they have none.
    const photo = popup.locator('.sites-popup__photo img');
    const none = popup.locator('.sites-popup__photo-status', { hasText: 'No photo on file.' });
    await expect(photo.first().or(none)).toBeVisible({ timeout: PANEL_TIMEOUT_MS });
    if (await photo.count()) {
      await expect(photo.first()).toHaveAttribute('src', /\/MapServer\/24\/\d+\/attachments\/\d+\?w=640$/);
      await expect(popup.locator('.sites-popup__photo').first()).toHaveAttribute('href', /\/attachments\/\d+\?w=2400$/);
      await expect.poll(() => photo.first().evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: PANEL_TIMEOUT_MS }).toBe(true);
    }
  });

  test('an SEZ unit with no photos shows no photo section', async ({ page }) => {
    // Kingsbury meadows was first evaluated in 2023, so it has no 2019 row and no photos.
    await openProgram(page, 49);
    await rowNamed(page, 'Kingsbury meadows').click();
    await profileSettled(page);
    await expect(profile(page).locator('.profile__photos-loading')).toHaveCount(0, { timeout: PANEL_TIMEOUT_MS });
    await expect(profile(page).locator('.profile__photo')).toHaveCount(0);
    await expect(profile(page).locator('.profile__section-title', { hasText: 'Photos' })).toHaveCount(0);
  });

  test("downloads the site's records as CSV", async ({ page }) => {
    await openProgram(page, 39);
    await rowNamed(page, 'Baldwin Beach').click();
    await profileSettled(page);
    const records = Number(await profile(page).getAttribute('data-records'));
    expect(records).toBeGreaterThan(10);
    const [download] = await Promise.all([
      page.waitForEvent('download'),
      profile(page).getByRole('button', { name: "Download this site's records" }).click(),
    ]);
    expect(download.suggestedFilename()).toMatch(/baldwin-beach-records\.csv$/);
    const text = fs.readFileSync((await download.path())!, 'utf-8');
    const lines = text.trim().split(/\r?\n/);
    expect(lines[0]).toContain('SITE_NAME');
    expect(lines[0]).toContain('COUNT_VALUE');
    expect(lines.length - 1).toBe(records);
    expect(lines.slice(1).every((line) => line.includes('Baldwin Beach'))).toBe(true);
  });

  test.describe('at phone width', () => {
    test.use({ viewport: { width: 375, height: 812 } });

    test('docks the profile under the map', async ({ page }) => {
      await openProgram(page, 39);
      await rowNamed(page, 'Baldwin Beach').click();
      await profileSettled(page);
      await expect(profile(page)).toHaveAttribute('data-mode', 'docked');
      await expect(profile(page).locator('.profile__name')).toHaveText('Baldwin Beach');
      await expect(profile(page).locator('.profile__name')).toBeFocused();
      const map = await page.locator('.sites-map__canvas').boundingBox();
      const card = await profile(page).boundingBox();
      expect(map && card && card.y >= map.y + map.height).toBe(true);
      // Nothing floats over the map in this form.
      await expect(page.locator('.sites-map__card')).toHaveCount(0);
      const width = await page.evaluate(() => document.documentElement.scrollWidth);
      expect(width).toBeLessThanOrEqual(375);
      await profile(page).getByRole('button', { name: 'Close Baldwin Beach' }).click();
      await expect(profile(page)).toHaveAttribute('data-state', 'idle');
      await expect(rowNamed(page, 'Baldwin Beach')).toBeFocused();
    });
  });
});
