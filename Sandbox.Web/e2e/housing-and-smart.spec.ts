// Two pages written in extra-categories.json, one for each way partner or unpublished data
// reaches the dashboard: Affordable and Workforce Housing charts files extracted from a TRPA
// spreadsheet, and SMART Traffic Cameras reads partner data TRPA loads to its own service.
// The housing charts must draw, since the app serves their files. The camera page reads
// maps.trpa.org live, so its panels only have to settle.
import type { Locator, Page } from '@playwright/test';

import { API_URL, PANEL_TIMEOUT_MS as PROFILE_TIMEOUT_MS, expect, seed, test } from './support';

const PANEL_TIMEOUT_MS = 60_000;

const chartPanels = (page: Page): Locator => page.locator('app-chart-panel');
const panelTitles = (page: Page): Locator => chartPanels(page).locator('.esa-card__title');

async function openProgram(page: Page, id: number, name: string): Promise<void> {
  await page.goto(`/programs/${id}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

test.describe('Affordable and Workforce Housing', () => {
  const { id, name, charts, category } = seed.affordableHousing;

  test('charts the housing inventory from its three extracted files', async ({ page }) => {
    await openProgram(page, id, name);
    await expect(page.locator('.program')).toHaveAttribute('data-template', 'charts');
    await expect(chartPanels(page)).toHaveCount(charts.length);
    await expect(panelTitles(page)).toHaveText([...charts]);
    for (const panel of await chartPanels(page).all()) {
      await expect(panel).toHaveAttribute('data-state', 'ready', { timeout: PANEL_TIMEOUT_MS });
      // Every chart credits the page the inventory was read from.
      await expect(panel.locator('.panel__source a')).toHaveText('TRPA Housing Progress page');
    }
    // No map: the inventory has parcel numbers and no coordinates.
    await expect(page.locator('app-sites-panel')).toHaveCount(0);
  });

  test('the table behind the first chart totals the inventory by jurisdiction and status', async ({ page, request }) => {
    const file = (await (await request.get('/data/housing/units-by-jurisdiction.json')).json()) as {
      rows: { Jurisdiction: string; Status: string; Units: number }[];
    };
    expect(file.rows.length).toBeGreaterThan(10);
    expect(new Set(file.rows.map((row) => row.Status))).toEqual(
      new Set(['Built before 2012', 'Built 2012 or later', 'Permitted, not built', 'Bonus units reserved']),
    );

    await openProgram(page, id, name);
    const first = chartPanels(page).first();
    await expect(first).toHaveAttribute('data-state', 'ready', { timeout: PANEL_TIMEOUT_MS });
    await first.getByRole('radio', { name: 'Table' }).click();
    await expect(first.locator('.panel__grid tbody tr')).toHaveCount(file.rows.length);
    await expect(first.locator('.panel__grid thead th')).toHaveText(['Jurisdiction', 'Status', 'Units']);
  });

  test('is listed under Housing and Economy, and its files are extracted-file sources', async ({ page, request }) => {
    const programs = (await (await request.get(`${API_URL}/monitoring-programs`)).json()) as {
      MonitoringProgramID: number;
      CategoryName: string;
      Template: string;
    }[];
    expect(programs.find((program) => program.MonitoringProgramID === id)).toMatchObject({ CategoryName: category, Template: 'charts' });

    // The Data Model page is LT Info's, so a sandbox-only program shows by name, not as a link.
    await page.goto('/data-model');
    await page.getByLabel('Find a program, chart, layer, or field').fill('units-built-by-year.json');
    const source = page.locator('.dm-source');
    await expect(source).toHaveCount(1);
    await source.locator('summary').click();
    await expect(source.locator('.dm-layer__head')).toContainText('Extracted File');
    await expect(source.locator('.dm-use__program').first()).toContainText(name);
  });
});

test.describe('SMART Traffic Cameras', () => {
  const { id, name, charts, cameras, category, service } = seed.smartCameras;

  test('leads with the camera map, then six charts that each settle', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    await expect(page.locator('.program')).toHaveAttribute('data-template', 'map');
    await expect(page.locator('app-sites-panel')).toHaveCount(1);
    await expect(chartPanels(page)).toHaveCount(charts.length);
    await expect(panelTitles(page)).toHaveText([...charts]);
    for (const panel of [...(await chartPanels(page).all()), page.locator('app-sites-panel')]) {
      await expect(panel).toHaveAttribute('data-state', /^(ready|empty|error)$/, { timeout: PANEL_TIMEOUT_MS });
    }
    // Every chart reads the camera service, and says so.
    for (const link of await chartPanels(page).locator('.panel__source a').all()) {
      await expect(link).toHaveAttribute('href', new RegExp(`^${service}/\\d+$`));
    }
  });

  test('the API seeds its cameras as mapped sites and its settings point at the camera service', async ({ request }) => {
    const programs = (await (await request.get(`${API_URL}/monitoring-programs`)).json()) as {
      MonitoringProgramID: number;
      CategoryName: string;
      SiteCount: number;
      PartnerNames: string[];
    }[];
    const listed = programs.find((program) => program.MonitoringProgramID === id)!;
    expect(listed).toMatchObject({ CategoryName: category, SiteCount: cameras });

    const detail = (await (await request.get(`${API_URL}/monitoring-programs/${id}`)).json()) as {
      DashboardConfig: { sitesLayer: { service: string; layer: number }; measures: { service: string; pick: string }[] };
    };
    expect(detail.DashboardConfig.sitesLayer).toMatchObject({ service, layer: 0 });
    expect(detail.DashboardConfig.measures).toHaveLength(charts.length);
    for (const measure of detail.DashboardConfig.measures) {
      expect(measure).toMatchObject({ service, pick: 'LocationName' });
    }
  });

  test('a camera opens with the aerial view attached to it in the map service', async ({ page, request }) => {
    test.setTimeout(PROFILE_TIMEOUT_MS * 3);
    const detail = (await (await request.get(`${API_URL}/monitoring-programs/${id}`)).json()) as {
      DashboardConfig: { siteProfile: { photos: { join: { from: string; to: string }; layout: string } } };
    };
    expect(detail.DashboardConfig.siteProfile.photos).toMatchObject({ join: { from: 'name', to: 'LocationName' }, layout: 'panorama' });

    await openProgram(page, id, name);
    const panel = page.locator('app-sites-panel');
    await expect(panel).toHaveAttribute('data-state', /^(ready|empty|error)$/, { timeout: PROFILE_TIMEOUT_MS });
    // The cameras come from maps.trpa.org; when it does not answer there is no camera to open.
    test.skip((await panel.getAttribute('data-state')) !== 'ready', 'The camera service did not answer.');

    await page.locator('.site-list__row:not([disabled])').filter({ hasText: 'Hwy 50 at Hwy 89' }).first().click();
    const profile = page.locator('app-site-profile');
    await expect(profile.locator('.profile__name')).toHaveText('Hwy 50 at Hwy 89');
    await expect(profile.locator('.profile__section-title')).toHaveText('Aerial view of the intersection', { timeout: PROFILE_TIMEOUT_MS });
    await expect(profile.locator('.profile__photo--wide img')).toHaveAttribute(
      'src',
      // A copy the map service scales down for the card.
      new RegExp(`^${service}/0/\\d+/attachments/\\d+\\?w=1200$`),
    );
  });

  test('the walking and biking chart marks the months with no counts as No Data', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    const walking = chartPanels(page).filter({ hasText: 'People walking and biking each day' });
    await expect(walking).toHaveAttribute('data-state', /^(ready|empty|error)$/, { timeout: PANEL_TIMEOUT_MS });
    test.skip((await walking.getAttribute('data-state')) !== 'ready', 'The camera service did not answer.');
    // The camera shown first is the one with the longest record, which has a hole of a month
    // in spring 2025 and another from mid-July.
    expect(Number(await walking.getAttribute('data-gaps'))).toBeGreaterThan(0);
    await expect(walking.locator('.visually-hidden').first()).toContainText('No data between');
  });

  test('the Data Model page lists the camera service as partner data in a TRPA pipeline', async ({ page }) => {
    await page.goto('/data-model');
    const card = page.locator('.dm-path', { has: page.locator('.dm-path__name', { hasText: /^Partner Data, TRPA Pipeline$/ }) });
    // The camera layer and its five tables, and the map plus the six charts on them.
    await expect(card.locator('.dm-path__facts')).toContainText('6 layers, 7 uses');
    await expect(card.locator('.dm-path__facts dt', { hasText: 'Transportation_SMART' })).toHaveCount(1);
    await expect(card.locator('.dm-path__facts')).toContainText('Tahoe Transportation District');
    await expect(card.getByRole('link', { name: 'SMART_Phase1' })).toHaveAttribute(
      'href',
      'https://github.com/trpa-agency/Transportation/tree/main/SMART_Phase1',
    );

    await page.getByLabel('Find a program, chart, layer, or field').fill('Transportation_SMART');
    const source = page.locator('.dm-source');
    await expect(source).toHaveCount(1);
    await source.locator('summary').click();
    await expect(source.locator('.dm-layer')).toHaveCount(6);
    for (const head of await source.locator('.dm-layer__head').all()) {
      await expect(head).toContainText('Partner Data, TRPA Pipeline');
    }
    await expect(source.locator('.dm-use__program').first()).toContainText(name);
  });
});
