// Three pages: Effective Population (a table with a Year column and a Month column), Bicycle
// and Pedestrian Network (a hand-kept layer of line segments, mapped and charted), and Forest
// Plot Network (a design with no measurements yet, charted from files made from its design
// record). The first two read the map server live, so a panel only has to settle; what the
// pages are made of is checked against the API and the files, which the sandbox owns. How rows
// are shaped is tested in measure-shape.spec.ts.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { API_URL, BASE_URL, PANEL_TIMEOUT_MS, expect, seed, test } from './support';

const TRANSPORTATION = 'https://maps.trpa.org/server/rest/services/DataDownloader_Transportation/MapServer';
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

interface Measure {
  title: string;
  service?: string;
  layer?: number;
  json?: string;
  sourceHref?: string;
  where?: string;
  x: string;
  xWith?: string;
  xType?: string;
  dateStep?: string;
  stat?: string;
  combine?: string;
  seriesBy?: string;
  seriesColors?: Record<string, string>;
  merge?: Record<string, Record<string, string>>;
}

interface Config {
  measures: Measure[];
  mapLayer?: { service: string; layer: number; geometry: string; colorBy: string; colors: Record<string, string>; countAsSites: boolean };
  overlays?: { service: string; layer: number; geometry: string; title: string }[];
}

async function listed(request: APIRequestContext, id: number): Promise<Listed> {
  const programs = (await (await request.get(`${API_URL}/monitoring-programs`)).json()) as Listed[];
  return programs.find((program) => program.MonitoringProgramID === id)!;
}

async function configOf(request: APIRequestContext, id: number): Promise<Config> {
  return ((await (await request.get(`${API_URL}/monitoring-programs/${id}`)).json()) as { DashboardConfig: Config }).DashboardConfig;
}

test.describe('Effective Population', () => {
  const { id, name, category, partners, charts } = seed.effectivePopulation;

  test('charts the monthly averages four ways, and every chart settles', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    await expect(page.locator('.program')).toHaveAttribute('data-template', 'charts');
    await expect(panelTitles(page)).toHaveText([...charts]);
    await expectSettled(await chartPanels(page).all());
  });

  test('the monthly chart has a point for every month counted, on one unbroken date axis', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    const monthly = chartPanels(page).first();
    await expectSettled([monthly]);
    test.skip((await monthly.getAttribute('data-state')) !== 'ready', 'The map service did not answer.');
    // January 2019 through August 2025 is 80 months; later months only add to it.
    expect(Number(await monthly.getAttribute('data-rows'))).toBeGreaterThanOrEqual(80);
    // Year and Month were read as dates: a month that failed to parse would leave a hole.
    expect(Number(await monthly.getAttribute('data-gaps'))).toBe(0);
  });

  test('the API lists it under Transportation, reading one table with its year and month as the date', async ({ request }) => {
    expect(await listed(request, id)).toMatchObject({ CategoryName: category, Template: 'charts', SiteCount: 0, PartnerCount: partners });
    const { measures } = await configOf(request, id);
    expect(measures.map((measure) => measure.title)).toEqual([...charts]);
    for (const measure of measures) expect(measure).toMatchObject({ service: TRANSPORTATION, layer: 27 });
    expect(measures[0]).toMatchObject({ x: 'Year', xWith: 'Month', xType: 'date', dateStep: 'month' });
    expect(measures[1]).toMatchObject({ x: 'Month', xType: 'category', seriesBy: 'Year' });
    // The yearly average leaves out the year still in progress.
    expect(measures[3]).toMatchObject({ stat: 'avg', where: 'Year < 2025' });
  });
});

test.describe('Bicycle and Pedestrian Network', () => {
  const { id, name, category, partners, charts } = seed.bikePedNetwork;

  test('leads with the map of segments, then five charts that each settle', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    await expect(page.locator('.program')).toHaveAttribute('data-template', 'map');
    await expect(page.locator('app-sites-panel')).toHaveCount(1);
    await expect(panelTitles(page)).toHaveText([...charts]);
    await expectSettled([...(await chartPanels(page).all()), page.locator('app-sites-panel')]);
  });

  test('the chart by agency reads the spellings of a name as one agency', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    const byAgency = chartPanels(page).filter({ hasText: 'Miles by the agency that maintains them' });
    await expectSettled([byAgency]);
    test.skip((await byAgency.getAttribute('data-state')) !== 'ready', 'The map service did not answer.');
    await byAgency.getByRole('radio', { name: 'Table' }).click();
    const agencies = await byAgency.locator('.panel__grid tbody tr td:first-child').allTextContents();
    // One row an agency, however the layer spells it, and none left in capitals.
    expect(new Set(agencies).size).toBe(agencies.length);
    expect(agencies).toContain('City of South Lake Tahoe');
    expect(agencies).toContain('Placer County');
    expect(agencies.filter((agency) => /^[A-Z ]+ COUNTY$/.test(agency))).toEqual([]);
  });

  test('the header says what the program is, and links to its page on another dashboard', async ({ page }) => {
    await openProgram(page, id, name);
    const header = page.locator('app-program-header');
    await expect(header.locator('.lead')).toHaveText(/^The Tahoe Region has 151 miles of bicycle and pedestrian facilities/);
    await expect(header.locator('app-header-links a').first()).toHaveAttribute('target', '_blank');
    // The lead is not said twice: the story below starts at the next paragraph.
    await expect(page.locator('app-program-story .prose p').first()).toHaveText(/^This page maps every segment/);
  });

  test('one filter above the page drives the map and every chart on its layer', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 4);
    await openProgram(page, id, name);
    const bar = page.locator('app-filter-bar');
    // By exact title: "Proposed miles by type of facility" holds the other title inside it.
    const titled = (title: string): Locator => chartPanels(page).filter({ has: page.locator('.esa-card__title', { hasText: new RegExp(`^\\s*${title}\\s*$`) }) });
    const byType = titled('Miles by type of facility');
    const proposed = titled('Proposed miles by type of facility');
    await expectSettled([byType, proposed, page.locator('app-sites-panel')]);
    test.skip((await byType.getAttribute('data-state')) !== 'ready', 'The map service did not answer.');
    await expect(bar).toHaveAttribute('data-active', '0');
    await expect(byType).toHaveAttribute('data-rows', '4');
    const proposedRows = await proposed.getAttribute('data-rows');

    // Choosing a type leaves one type in the chart of types, and the map loads again.
    await bar.locator('esa-button-toggle[data-field="CLASS"]').getByRole('radio', { name: 'Shared-use path' }).click();
    await expect(bar).toHaveAttribute('data-active', '1');
    await expect(byType).toHaveAttribute('data-rows', '1', { timeout: PANEL_TIMEOUT_MS });
    await expectSettled([page.locator('app-sites-panel')]);
    // The proposed network is another layer with its own classes: the filter leaves it alone.
    await expect(proposed).toHaveAttribute('data-rows', proposedRows!);

    // Back to all types.
    await bar.locator('esa-button-toggle[data-field="CLASS"]').getByRole('radio', { name: 'All types' }).click();
    await expect(bar).toHaveAttribute('data-active', '0');
    await expect(byType).toHaveAttribute('data-rows', '4', { timeout: PANEL_TIMEOUT_MS });
  });

  test('a chart of four bars sits beside the chart of agencies, a third and two thirds of the row', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await openProgram(page, id, name);
    const widths = await chartPanels(page).evaluateAll((panels) => panels.slice(0, 2).map((panel) => panel.getBoundingClientRect().width));
    expect(widths[1]).toBeGreaterThan(widths[0] * 1.8);
    const tops = await chartPanels(page).evaluateAll((panels) => panels.slice(0, 2).map((panel) => Math.round(panel.getBoundingClientRect().top)));
    expect(tops[0]).toBe(tops[1]);
  });

  test('at phone width the filters do not widen the page', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await openProgram(page, id, name);
    await expect(page.locator('app-filter-bar')).toBeVisible();
    await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(375);
  });

  test('the API lists it under Transportation: a line layer colored by type, the proposed network over it', async ({ request }) => {
    expect(await listed(request, id)).toMatchObject({ CategoryName: category, Template: 'map', PartnerCount: partners });
    const config = await configOf(request, id);
    expect(config.mapLayer).toMatchObject({ service: TRANSPORTATION, layer: 3, geometry: 'line', colorBy: 'CLASS', countAsSites: false });
    expect(config.overlays).toEqual([expect.objectContaining({ service: TRANSPORTATION, layer: 4, geometry: 'line' })]);
    expect(config.measures.map((measure) => measure.title)).toEqual([...charts]);
    // A type keeps the color the map gives it in the chart that stacks by type.
    expect(config.measures[2]).toMatchObject({ seriesBy: 'CLASS', combine: 'sum', seriesColors: config.mapLayer!.colors });
    // The agency chart names the spellings it reads as one.
    expect(config.measures[1].merge?.['MAINT_JURS']?.['PLACER COUNTY']).toBe('Placer County');
    expect(config.measures[1]).toMatchObject({ combine: 'sum' });
  });
});

test.describe('Forest Plot Network', () => {
  const { id, name, category, partners, charts, files } = seed.forestPlots;

  test('charts the design from its files, and every chart is ready', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    await expect(page.locator('.program')).toHaveAttribute('data-template', 'charts');
    await expect(panelTitles(page)).toHaveText([...charts]);
    // Files the site serves itself: nothing to wait on but the app.
    for (const panel of await chartPanels(page).all()) {
      await expect(panel).toHaveAttribute('data-state', 'ready', { timeout: PANEL_TIMEOUT_MS });
    }
    // 120 plots at the minimum, 30 more at the full design: three forest types, two levels.
    await expect(chartPanels(page).first()).toHaveAttribute('data-rows', '6');
  });

  test('the files hold the design: 150 plots, 115,396 acres, and no plot locations', async ({ request }) => {
    const rowsOf = async (file: string): Promise<Record<string, unknown>[]> => {
      const response = await request.get(`${BASE_URL}/data/forest-plots/${file}`);
      expect(response.ok(), file).toBe(true);
      return ((await response.json()) as { rows: Record<string, unknown>[] }).rows;
    };
    const [plots, acres, margins] = await Promise.all(files.map(rowsOf));
    const total = (rows: Record<string, unknown>[], field: string): number => rows.reduce((sum, row) => sum + Number(row[field]), 0);
    expect(total(plots, 'Plots')).toBe(150);
    expect(total(plots.filter((row) => row['Level'] === 'Minimum design'), 'Plots')).toBe(120);
    expect(total(acres, 'Acres')).toBe(115396);
    // 40 plots alone: plus or minus 15.5 points, the figure in the design record.
    expect(margins.find((row) => row['Plots'] === 40 && row['Estimate'] === 'Plots alone')?.['Points']).toBe(15.5);
    // The site list is not final, so no file carries a coordinate.
    for (const rows of [plots, acres, margins]) {
      for (const row of rows) expect(Object.keys(row).join(' ')).not.toMatch(/lat|lon|x_|y_|easting|northing|coord/i);
    }
  });

  test('the API lists it under Forest Structure, each chart citing the design record', async ({ request }) => {
    expect(await listed(request, id)).toMatchObject({ CategoryName: category, Template: 'charts', SiteCount: 0, PartnerCount: partners });
    const { measures } = await configOf(request, id);
    expect(measures.map((measure) => measure.title)).toEqual([...charts]);
    expect(measures.map((measure) => measure.json)).toEqual(files.map((file) => `data/forest-plots/${file}`));
    for (const measure of measures) {
      expect(measure.sourceHref).toBe('https://github.com/trpa-agency/ForestHealth/blob/main/plot-network-design/docs/SAMPLE-DESIGN-2026-10-19.md');
    }
  });
});
