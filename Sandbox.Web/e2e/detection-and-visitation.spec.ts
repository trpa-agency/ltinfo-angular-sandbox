// Two pages on raw monitoring records that sat on maps.trpa.org with no page: Calcium and eDNA
// Sampling (three small services: sites, samples, and eDNA samples) and Visitation and Lodging
// (two partner tables TRPA compiles). Both read the map server live, so a panel only has to
// settle; what the pages are made of is checked against the API, which the sandbox owns.
import type { Locator, Page } from '@playwright/test';

import { API_URL, PANEL_TIMEOUT_MS, expect, seed, test } from './support';

const ROOT = 'https://maps.trpa.org/server/rest/services';
const chartPanels = (page: Page): Locator => page.locator('app-chart-panel');
const panelTitles = (page: Page): Locator => chartPanels(page).locator('.esa-card__title');

async function openProgram(page: Page, id: number, name: string): Promise<void> {
  await page.goto(`/programs/${id}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

async function expectSettled(panels: Locator[]): Promise<void> {
  for (const panel of panels) {
    await expect(panel).toHaveAttribute('data-state', /^(ready|empty|error)$/, { timeout: PANEL_TIMEOUT_MS });
  }
}

interface Listed {
  MonitoringProgramID: number;
  CategoryName: string;
  Template: string;
  SiteCount: number;
  PartnerCount: number;
}

async function listed(request: import('@playwright/test').APIRequestContext, id: number): Promise<Listed> {
  const programs = (await (await request.get(`${API_URL}/monitoring-programs`)).json()) as Listed[];
  return programs.find((program) => program.MonitoringProgramID === id)!;
}

test.describe('Calcium and eDNA Sampling', () => {
  const { id, name, category, sites, charts } = seed.calciumEdna;

  test('leads with the map of calcium sites, then four charts that each settle', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    await expect(page.locator('.program')).toHaveAttribute('data-template', 'map');
    await expect(page.locator('app-sites-panel')).toHaveCount(1);
    // The three measures, and the sites sampled each year.
    await expect(chartPanels(page)).toHaveCount(charts.length + 1);
    for (const title of charts) await expect(panelTitles(page).filter({ hasText: title })).toHaveCount(1);
    await expect(panelTitles(page).filter({ hasText: 'Sites monitored each year' })).toHaveCount(1);
    await expectSettled([...(await chartPanels(page).all()), page.locator('app-sites-panel')]);
  });

  test('the API seeds its sites and names the three services it reads', async ({ request }) => {
    expect(await listed(request, id)).toMatchObject({ CategoryName: category, Template: 'map', SiteCount: sites });
    const detail = (await (await request.get(`${API_URL}/monitoring-programs/${id}`)).json()) as {
      DashboardConfig: {
        sitesLayer: { service: string; name: string; code: string; status: string };
        sitesPerYear: { service: string; extract: boolean };
        overlays: { service: string; title: string; geometry: string }[];
        measures: { title: string; service: string; xNames?: Record<string, string> }[];
      };
    };
    const config = detail.DashboardConfig;
    expect(config.sitesLayer).toMatchObject({ service: `${ROOT}/Calcium_Sites/MapServer`, name: 'description', code: 'SITE_NAME', status: 'sample_year' });
    expect(config.sitesPerYear).toMatchObject({ service: `${ROOT}/Calcium_Survey/MapServer`, extract: true });
    expect(config.overlays).toEqual([expect.objectContaining({ service: `${ROOT}/eDNA_Samples/MapServer`, geometry: 'point' })]);
    expect(config.measures.map((measure) => measure.title)).toEqual([...charts]);
    // The ranked chart names each site by its place, with the site code after it.
    expect(config.measures[0].xNames?.['T1']).toBe('Cave Rock Boat Ramp (T1)');
  });

  test('the chart of survey days marks the years with no survey as No Data', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    const byDay = chartPanels(page).filter({ hasText: 'Average calcium by survey day' });
    await expectSettled([byDay]);
    test.skip((await byDay.getAttribute('data-state')) !== 'ready', 'The calcium service did not answer.');
    // Surveys in 2021, 2025, and 2026, with nothing between 2021 and 2025.
    expect(Number(await byDay.getAttribute('data-gaps'))).toBeGreaterThan(0);
  });
});

test.describe('Visitation and Lodging', () => {
  const { id, name, category, partners, charts } = seed.visitation;

  test('charts lodging and park visitor records, and every chart settles', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    await expect(page.locator('.program')).toHaveAttribute('data-template', 'charts');
    await expect(page.locator('app-sites-panel')).toHaveCount(0);
    await expect(panelTitles(page)).toHaveText([...charts]);
    await expectSettled(await chartPanels(page).all());
  });

  test('the API lists it beside the lodging tax page, with the agencies whose reports it compiles', async ({ request }) => {
    expect(await listed(request, id)).toMatchObject({ CategoryName: category, Template: 'charts', PartnerCount: partners });
    const detail = (await (await request.get(`${API_URL}/monitoring-programs/${id}`)).json()) as {
      DashboardConfig: { measures: { service: string; layer: number; format?: string; pick?: string }[] };
    };
    const measures = detail.DashboardConfig.measures;
    expect(measures.map((measure) => `${measure.service.replace(`${ROOT}/`, '')}/${measure.layer}`)).toEqual([
      'Transportation_Planning/MapServer/13',
      'Transportation_Planning/MapServer/13',
      'Transportation_Planning/MapServer/13',
      'Demographics/MapServer/33',
      'Demographics/MapServer/33',
    ]);
    // Occupancy is a share, shown as a percent, for one reporting area at a time.
    expect(measures[2]).toMatchObject({ format: '.0%', pick: 'AreaName' });
  });
});
