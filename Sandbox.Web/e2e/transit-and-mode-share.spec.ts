// Two Transportation pages on tables that sat with the Climate Resilience Dashboard's and had
// no page here: Transit Ridership (a row a month, a column a service, the month as text) and
// Travel Mode Share (counts from three sources that the reader wants as shares). Both read the
// map server live, so a panel only has to settle; what the pages are made of is checked against
// the API, which the sandbox owns. How the rows are shaped is tested in measure-shape.spec.ts.
import type { Locator, Page } from '@playwright/test';

import { API_URL, PANEL_TIMEOUT_MS, expect, seed, test } from './support';

const CLIMATE = 'https://maps.trpa.org/server/rest/services/LTinfo_Climate_Resilience_Dashboard/MapServer';
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

interface Detail {
  DashboardConfig: {
    measures: {
      title: string;
      service: string;
      layer: number;
      where?: string;
      x: string;
      xWith?: string;
      xType?: string;
      dateParts?: string;
      dateStep?: string;
      combine?: string;
      share?: boolean;
      seriesBy?: string;
      seriesColors?: Record<string, string>;
      pick?: string;
      format?: string;
      y: string | { field: string; name: string }[];
    }[];
  };
}

async function listed(request: import('@playwright/test').APIRequestContext, id: number): Promise<Listed> {
  const programs = (await (await request.get(`${API_URL}/monitoring-programs`)).json()) as Listed[];
  return programs.find((program) => program.MonitoringProgramID === id)!;
}

async function measuresOf(request: import('@playwright/test').APIRequestContext, id: number): Promise<Detail['DashboardConfig']['measures']> {
  const detail = (await (await request.get(`${API_URL}/monitoring-programs/${id}`)).json()) as Detail;
  return detail.DashboardConfig.measures;
}

test.describe('Transit Ridership', () => {
  const { id, name, category, partners, charts, services } = seed.transitRidership;

  test('charts the ridership table three ways, and every chart settles', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    await expect(page.locator('.program')).toHaveAttribute('data-template', 'charts');
    await expect(page.locator('app-sites-panel')).toHaveCount(0);
    await expect(panelTitles(page)).toHaveText([...charts]);
    await expectSettled(await chartPanels(page).all());
  });

  test('the chart by year has one row for each full year, added up from the months', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    const byYear = chartPanels(page).filter({ hasText: 'Rides each year, by service' });
    await expectSettled([byYear]);
    test.skip((await byYear.getAttribute('data-state')) !== 'ready', 'The map service did not answer.');
    // 2018 through 2022: the months of 2017 and 2023 are left out, and 60 months make five rows.
    expect(Number(await byYear.getAttribute('data-rows'))).toBe(5);
  });

  test('the API lists it under Transportation with its operators, reading one table by month, year, and month of the year', async ({ request }) => {
    expect(await listed(request, id)).toMatchObject({ CategoryName: category, Template: 'charts', SiteCount: 0, PartnerCount: partners });
    const measures = await measuresOf(request, id);
    expect(measures.map((measure) => measure.title)).toEqual([...charts]);
    for (const measure of measures) expect(measure).toMatchObject({ service: CLIMATE, layer: 131 });
    // By month: the text month read as a date, a series for each service column.
    expect(measures[0]).toMatchObject({ x: 'MONTH', xType: 'date', dateStep: 'month' });
    expect((measures[0].y as { name: string }[]).map((y) => y.name)).toEqual([...services]);
    // By year: the year read out of the month, and the months added up in the browser.
    expect(measures[1]).toMatchObject({ dateParts: 'MONTH', x: 'MONTH_year', combine: 'sum' });
    // By month of the year: a line for each year.
    expect(measures[2]).toMatchObject({ dateParts: 'MONTH', x: 'MONTH_month', xType: 'month', seriesBy: 'MONTH_year', y: 'Total' });
    // The two months the table never filled in are left out of the monthly charts.
    expect(measures[0].where).toBe('TTD_Fixed_Route > 0');
    expect(measures[2].where).toBe('TTD_Fixed_Route > 0');
  });
});

test.describe('Travel Mode Share', () => {
  const { id, name, category, partners, charts, sources } = seed.modeShare;

  test('charts each source apart, and every chart settles', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    await expect(page.locator('.program')).toHaveAttribute('data-template', 'charts');
    await expect(panelTitles(page)).toHaveText([...charts]);
    await expectSettled(await chartPanels(page).all());
  });

  test('the survey chart shows shares that add up to the whole, with the responses behind them in the table', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openProgram(page, id, name);
    const survey = chartPanels(page).filter({ hasText: 'Mode share in TRPA travel surveys' });
    await expectSettled([survey]);
    test.skip((await survey.getAttribute('data-state')) !== 'ready', 'The map service did not answer.');
    // Summer surveys by default: four of them, five ways of traveling each.
    expect(Number(await survey.getAttribute('data-rows'))).toBe(20);
    await survey.getByRole('radio', { name: 'Table' }).click();
    await expect(survey.locator('thead th')).toHaveText(['Survey year', 'Travel', 'Season', 'Share of responses', 'Responses']);
    const firstRow = survey.locator('tbody tr').first().locator('td');
    // A share reads as a percent and the count beside it as a plain number.
    await expect(firstRow.nth(3)).toHaveText(/^\d+%$/);
    await expect(firstRow.nth(4)).toHaveText(/^[\d,]+$/);
  });

  test('the API lists it under Transportation, with one chart for each source, each a share of its own total', async ({ request }) => {
    expect(await listed(request, id)).toMatchObject({ CategoryName: category, Template: 'charts', SiteCount: 0, PartnerCount: partners });
    const measures = await measuresOf(request, id);
    expect(measures.map((measure) => measure.title)).toEqual([...charts]);
    expect(measures.map((measure) => measure.where)).toEqual(sources.map((source) => `Source = '${source}'`));
    for (const measure of measures) {
      expect(measure).toMatchObject({ service: CLIMATE, layer: 136, x: 'Year', y: 'Number', seriesBy: 'Mode', share: true });
    }
    // A way of traveling keeps one color across the three charts, though LOCUS has four series, not five.
    expect(measures[0].seriesColors?.['Public Transit']).toMatch(/^var\(--color-background-dataviz-categorical-\d\)$/);
    for (const measure of measures) expect(measure.seriesColors).toEqual(measures[0].seriesColors);
    // The surveys alternate seasons, so the season is a choice; the two modeled sources name a
    // season and a year on the axis, and the day is the choice.
    expect(measures[0]).toMatchObject({ pick: 'Season', format: '.0%' });
    expect(measures[1]).toMatchObject({ xWith: 'Season', pick: 'Day', format: '.1%' });
    expect(measures[2]).toMatchObject({ xWith: 'Season', pick: 'Day', format: '.1%' });
  });
});
