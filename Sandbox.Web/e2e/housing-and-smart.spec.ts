// Two pages written in extra-categories.json, one for each way partner or unpublished data
// reaches the dashboard: Affordable and Workforce Housing charts files extracted from a TRPA
// spreadsheet, and SMART Traffic Cameras reads partner data TRPA loads to its own service.
// The housing charts must draw, since the app serves their files. The camera page reads
// maps.trpa.org live, so its panels only have to settle.
import type { Locator, Page } from '@playwright/test';

import { API_URL, expect, seed, test } from './support';

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

    await page.goto('/data-model');
    await page.getByRole('textbox', { name: 'Search' }).fill('units-built-by-year.json');
    await expect(page.locator('.pick')).toHaveCount(1);
    await expect(page.locator('.flow .layer-path')).toContainText('Extracted File');
    await expect(page.locator('.use').getByRole('link', { name })).toHaveAttribute('href', `/programs/${id}`);
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

  test('the Data Model page lists the camera service as partner data in a TRPA pipeline', async ({ page }) => {
    await page.goto('/data-model');
    const card = page.locator('.path[data-path="partner-pipeline"]');
    // The camera layer and its five tables, and the map plus the six charts on them.
    await expect(card.locator('.path__facts')).toContainText('6 layers, 7 uses');
    await expect(card.locator('.path__service')).toHaveText('Transportation_SMART');
    await expect(card.locator('.path__pipeline')).toContainText('Tahoe Transportation District');
    await expect(card.locator('.path__pipeline a')).toHaveAttribute(
      'href',
      'https://github.com/trpa-agency/Transportation/tree/main/SMART_Phase1',
    );

    await page.locator('.pick[data-source="Transportation_SMART"]').click();
    const flow = page.locator('.flow');
    await expect(flow.locator('.flow__layer')).toHaveCount(6);
    for (const path of await flow.locator('.layer-path').all()) {
      await expect(path).toContainText('Partner Data, TRPA Pipeline');
    }
    await expect(flow.locator('.use').first().getByRole('link', { name })).toHaveAttribute('href', `/programs/${id}`);
  });
});
