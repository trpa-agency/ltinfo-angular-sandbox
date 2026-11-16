// The Data Model page, ported from LT Info's Monitoring Dashboard redesign. It reads a snapshot of
// LT Info's monitoring-new routes from public/data/ltinfo/, not the sandbox seed, so the counts
// here come from that snapshot, fetched from the site. The checks that reach maps.trpa.org are
// not run (a slow map server should not fail a test).
import { expect, test } from './support';

const PATHS = [
  'TRPA Map Service',
  'Partner Data, TRPA Pipeline',
  'Partner Map Service',
  'LT Info Native Data',
  'Extracted File',
  'LT Info Entered Data',
];

test.describe('Data Model page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/data-model');
    await expect(page.getByRole('heading', { level: 1, name: 'Data Model' })).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'How Data Gets In' })).toBeVisible();
  });

  test('states the rule and the exception, and says the LT Info data is a snapshot', async ({ page }) => {
    await expect(page).toHaveTitle(/^Data Model \| Monitoring Dashboard/);
    const rule = page.locator('.dm-rule');
    await expect(rule.first()).toContainText('Every chart on the Monitoring Dashboard is an indicator in LT Info');
    await expect(rule.nth(1)).toContainText('Transit ridership and the stormwater tools');
    await expect(page.locator('.dm-snapshot')).toContainText(/LT Info's as of .+2026/);
    await expect(page.locator('.dm-stat')).toHaveCount(4);
  });

  test('draws the tables with the two proposed ones and the native reader endpoint', async ({ page }) => {
    const svg = page.locator('app-schema-diagram svg');
    for (const table of ['IndicatorDataSource', 'MonitoringProgramLayer', 'MonitoringProgram', 'Indicator']) {
      await expect(svg.getByText(table, { exact: true }).first()).toBeVisible();
    }
    await expect(svg.getByText('NativeSourceID', { exact: true })).toHaveCount(1);
    await expect(svg.getByText('LT Info native readers', { exact: true })).toHaveCount(1);
    await expect(page.locator('[data-table="binding-coverage"] tbody tr').first()).toBeVisible();
  });

  test('lists the six ingestion paths, with the three native readers on their card', async ({ page }) => {
    const paths = page.locator('.dm-path');
    await expect(paths).toHaveCount(PATHS.length);
    for (const [i, label] of PATHS.entries()) {
      await expect(paths.nth(i).locator('.dm-path__name')).toHaveText(label);
    }
    const native = page.locator('.dm-path[data-for-indicators="native"]');
    await expect(native).toHaveCount(1);
    await expect(native.locator('.dm-path__flag')).toHaveText('Transit ridership and stormwater only');
    await expect(native.locator('[data-native-source]')).toHaveCount(3);
    await expect(native.locator('[data-native-source="stormwater-load-reduction"]')).toContainText('CreditDeclaration');
  });

  test('the register switches views and downloads the view as CSV', async ({ page }) => {
    const dataModel = (await (await page.request.get('data/ltinfo/monitoring-new-data-model.json')).json()) as { DataSources: unknown[] };
    const toggle = page.getByRole('group', { name: 'Register view' });
    await expect(page.locator('[data-table="register-programs"] tbody tr').first()).toBeVisible();

    await toggle.getByRole('button', { name: /Scheduled Sources/ }).click();
    await expect(toggle.getByRole('button', { name: /Scheduled Sources/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-table="register-scheduled"] tbody tr')).toHaveCount(dataModel.DataSources.length);

    await toggle.getByRole('button', { name: /^Indicators/ }).click();
    await expect(page.locator('[data-table="register-indicators"] tbody tr').first()).toBeVisible();

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download CSV' }).click();
    expect((await download).suggestedFilename()).toBe('monitoring-data-model-indicators.csv');
  });

  test('traces the planned sources, and the search narrows them', async ({ page }) => {
    const sources = page.locator('.dm-source');
    await expect(sources.first()).toBeVisible();
    const all = await sources.count();
    const search = page.getByLabel('Find a program, chart, layer, or field');
    await search.fill('Yellow Cress');
    await expect.poll(() => sources.count()).toBeLessThan(all);
    await expect(sources.first()).toBeVisible();
    await search.fill('zzzz-no-such-thing');
    await expect(page.locator('.dm-empty')).toContainText('Nothing matches');
  });

  test('About Monitoring links to the page', async ({ page }) => {
    await page.goto('/#about');
    await page.locator('app-about-monitoring').getByRole('link', { name: 'Data Model' }).click();
    await expect(page).toHaveURL(/\/data-model$/);
  });
});

test.describe('Data Model page at 375 px wide', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('does not scroll sideways; the diagram and the register scroll in their own boxes', async ({ page }) => {
    await page.goto('/data-model');
    await expect(page.locator('.dm-path').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    for (const box of ['.erd', '.dm-register']) {
      expect(await page.locator(box).evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    }
  });
});
