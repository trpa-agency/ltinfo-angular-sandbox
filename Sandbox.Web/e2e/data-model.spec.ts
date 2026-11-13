// The Data Model page: the table diagram, the ingestion paths with their acceptance criteria,
// and every chart and map traced to its source. The checks that reach maps.trpa.org are not
// run here (a slow map server should not fail a test); the file checks are, because the app
// serves those files itself.
import { expect, seed, test } from './support';

const PATHS = [
  'TRPA Web Service',
  'Partner Data, TRPA Pipeline',
  'Partner Web Service',
  'LT Info Entered Data',
  'Extracted File',
];

test.describe('Data Model page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/data-model');
    await expect(page.getByRole('heading', { level: 1, name: 'Data Model' })).toBeVisible();
  });

  test('draws the six tables, the settings keys, and their relationships', async ({ page }) => {
    await expect(page).toHaveTitle(/^Data Model \| Monitoring Dashboard/);
    const diagram = page.locator('app-schema-diagram');
    await expect(diagram.locator('.erd__entity')).toHaveCount(7);
    for (const table of [
      'MonitoringProgram',
      'MonitoringProgramCategory',
      'MonitoringProgramOrganization',
      'Organization',
      'MonitoringSite',
      'MonitoringProgramImage',
    ]) {
      await expect(diagram.locator('.erd__name', { hasText: new RegExp(`^${table}$`) })).toHaveCount(1);
    }
    await expect(diagram.locator('.erd__link')).toHaveCount(9);
    await expect(diagram.locator('.erd__key[data-key="PK"]')).toHaveCount(6);
    // The picture has a text alternative that states each relationship.
    await expect(diagram.locator('svg desc')).toContainText('A category has many programs');
  });

  test('lists the five ingestion paths, each with criteria a person confirms', async ({ page }) => {
    const cards = page.locator('.path');
    await expect(cards).toHaveCount(PATHS.length);
    await expect(cards.locator('.path__name')).toHaveText(PATHS);
    for (const card of await cards.all()) {
      await expect(card.getByRole('heading', { name: 'Confirmed by a Person' })).toBeVisible();
      await expect(card.locator('.path__facts')).toContainText('Steward');
    }
    // Every path the app can test says so; data entered in LT Info has no source to query.
    await expect(page.getByRole('heading', { name: 'Checked by the App' })).toHaveCount(4);
    await expect(cards.filter({ hasText: 'Extracted File' }).locator('.path__facts')).toContainText(/\d+ files, \d+ uses/);
  });

  test('traces every chart and map to a source, most used first', async ({ page }) => {
    const tiles = page.locator('.dm__tiles esa-stat');
    await expect(tiles).toHaveCount(5);
    const sources = page.locator('.pick');
    await expect(sources.first()).toHaveAttribute('data-source', 'LTInfo_Monitoring');
    await expect(sources.first()).toHaveAttribute('aria-pressed', 'true');
    // Two services share the name Vegetation; each says which it is.
    await expect(page.locator('.pick[data-source="Vegetation (MapServer)"]')).toHaveCount(1);
    await expect(page.locator('.pick[data-source="Vegetation (FeatureServer)"]')).toHaveCount(1);

    const flow = page.locator('.flow');
    await expect(flow.getByRole('heading', { level: 3 }).getByRole('link')).toHaveAttribute(
      'href',
      'https://maps.trpa.org/server/rest/services/LTInfo_Monitoring/MapServer',
    );
    await expect(flow.locator('.flow__layer').first().locator('.layer__id')).toHaveAttribute('href', /\/MapServer\/\d+$/);
    await expect(flow.locator('.use').first().locator('.use__program a')).toHaveAttribute('href', /\/programs\/\d+$/);
    await expect(flow.locator('.layer-path').first()).toContainText('TRPA Web Service');
  });

  test('search narrows the sources to the matching charts and maps', async ({ page }) => {
    const search = page.getByRole('textbox', { name: 'Search' });
    await search.fill('lake-level.json');
    await expect(page.locator('.pick')).toHaveCount(1);
    await expect(page.locator('.pick')).toHaveAttribute('data-source', 'lake-level.json');
    const use = page.locator('.use');
    await expect(use).toHaveCount(1);
    await expect(use.getByRole('link', { name: seed.lakeLevel.name })).toHaveAttribute('href', `/programs/${seed.lakeLevel.id}`);
    await expect(use.locator('.use__facts')).toContainText('Climate Resilience Dashboard');

    await search.fill('no such chart anywhere');
    await expect(page.getByRole('heading', { name: /^Nothing matches/ })).toBeVisible();
  });

  test('Run Checks tests a data file and reports each result', async ({ page }) => {
    await page.locator('.pick[data-source="lake-level.json"]').click();
    const flow = page.locator('.flow');
    await expect(flow.locator('.layer-path')).toContainText('Extracted File');
    await flow.getByRole('button', { name: 'Run Checks' }).click();

    await expect(flow.locator('.flow__score')).toContainText('3 passed');
    await expect(flow.locator('.flow__score')).not.toContainText('failed');
    await expect(flow.locator('.layer-path .check')).toContainText(/Source answers\s*[\d,]+ records/);
    const checks = flow.locator('.use__checks .check');
    await expect(checks).toHaveCount(2);
    await expect(checks.nth(0)).toContainText(/Fields exist\s*\d+ of \d+ found/);
    await expect(checks.nth(1)).toContainText('Source cited');
  });

  test('the table view lists one record per use and downloads them as CSV', async ({ page }) => {
    await page.locator('.dm__toolbar esa-button-toggle').getByRole('radio', { name: 'Table' }).click();
    const rows = page.locator('.inventory__table tbody tr');
    const total = await page.locator('.inventory__count').textContent();
    expect(total).toMatch(/^\d+ records$/);
    await expect(rows).toHaveCount(Number(total!.split(' ')[0]));
    await expect(page.locator('.inventory__table thead th')).toHaveText([
      'Source',
      'Layer',
      'Used As',
      'Title',
      'Program',
      'Fields',
      'Filter',
    ]);

    const [download] = await Promise.all([
      page.waitForEvent('download'),
      page.getByRole('button', { name: 'Download CSV' }).click(),
    ]);
    expect(download.suggestedFilename()).toBe('monitoring-dashboard-data-sources.csv');
  });

  test('About Monitoring links to the page', async ({ page }) => {
    await page.goto('/#about');
    await page.locator('app-about-monitoring').getByRole('link', { name: 'Data Model' }).click();
    await expect(page).toHaveURL(/\/data-model$/);
  });
});

test.describe('Data Model page at 375 px wide', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('does not scroll sideways; the table diagram scrolls in its own box', async ({ page }) => {
    await page.goto('/data-model');
    await expect(page.locator('.pick').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const erd = page.locator('.erd');
    expect(await erd.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  });
});
