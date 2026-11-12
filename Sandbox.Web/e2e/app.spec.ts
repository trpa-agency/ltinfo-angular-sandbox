// Browser tests for Sandbox.Web at BASE_URL. They run the same way against the
// dev server and against the production nginx build: every page is opened by
// its address, every wait is for something a user can see, and nothing reads
// dev-server internals.
//
// The home page is one scrolling page: the hero, the threshold categories beside
// the site map, All Programs (the filterable list), and About Monitoring. The
// list tests open it at /#all-programs. The home page tests are in home.spec.ts.
//
// The search box, the selects, and the toggles are Ecology Lit elements with
// shadow roots. Playwright locators reach into open shadow roots, so they are
// found by role and name like any other control.
//
// The app follows Ecology's default theme (no data-theme attribute, DM Sans):
// neutral containers and badges, and no category colors anywhere on the page.
//
// The chart and map panels read the TRPA map service, a live server outside
// the sandbox. The tests hold the panels only to their contract: the right
// number of app-chart-panel and app-sites-panel hosts, each of which leaves
// data-state="loading" within PANEL_TIMEOUT_MS. What a panel draws is tested
// with the panel, not here.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import {
  API_URL,
  FONT_PATTERN,
  PANEL_TIMEOUT_MS,
  TEMPLATE_LABELS,
  expect,
  fontLoaded,
  resolvedColor,
  seed,
  test,
} from './support';
import type { Template } from './support';

const programUrl = (id: number): string => `/programs/${id}`;
const apiProgramUrl = (id: number): string => `${API_URL}/monitoring-programs/${id}`;

// ---- the list page ----
const rows = (page: Page): Locator => page.locator('table.programs-table tbody tr');
const resultCount = (page: Page): Locator => page.locator('.list-frame__count');
const searchBox = (page: Page): Locator => page.getByRole('textbox', { name: 'Search programs' });
const categorySelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Category' });
const layoutSelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Layout' });
const featuredOnly = (page: Page): Locator => page.getByRole('radio', { name: 'Featured only' });
const allPrograms = (page: Page): Locator => page.getByRole('radio', { name: 'All programs' });
/** A total in the home page header band, by its label. */
const heroTotal = (page: Page, label: string): Locator =>
  page.locator('.hero-stat').filter({ hasText: label }).locator('dd');
const footer = (page: Page): Locator => page.locator('.app-footer');
/** The table row of one program, found by its link. */
const rowOf = (page: Page, name: string): Locator =>
  rows(page).filter({ has: page.getByRole('link', { name, exact: true }) });

// Table columns, counted the way :nth-child counts them: the program is the row header.
const CATEGORY_CELL = 'td:nth-child(2)';
const LAYOUT_CELL = 'td:nth-child(3)';
const FEATURED_CELL = 'td:nth-child(5)';

// ---- the program page ----
/** The wrapper around the template on screen; data-template names it. */
const program = (page: Page): Locator => page.locator('.program');
const header = (page: Page): Locator => page.locator('app-program-header');
/** Every titled section of the page, in document order. */
const sections = (page: Page): Locator => program(page).locator('[data-section]');
const chartPanels = (page: Page): Locator => page.locator('app-chart-panel');
const sitesPanels = (page: Page): Locator => page.locator('app-sites-panel');
const tiles = (page: Page): Locator => header(page).locator('.esa-stat');
const heroImage = (page: Page): Locator => header(page).locator('img.hero__img');
const heroButton = (page: Page): Locator => header(page).locator('button.hero__open');
const banner = (page: Page): Locator => header(page).locator('app-photo-banner');
const galleryButtons = (page: Page): Locator => page.locator('app-photo-gallery button.gallery__open');
const lightbox = (page: Page): Locator => page.locator('dialog.lightbox');
const partnerItems = (page: Page): Locator => page.locator('.partners li');

// The layout control.
const layoutRadio = (page: Page, template: Template): Locator =>
  page.getByRole('radio', { name: TEMPLATE_LABELS[template], exact: true });
const saveLayout = (page: Page): Locator => page.getByRole('button', { name: 'Save layout' });
const previewNotice = (page: Page): Locator => page.locator('.layout__notice');

// The Featured card.
const savedValue = (page: Page): Locator => page.locator('.featured__value');
const featuredButton = (page: Page): Locator => page.locator('.featured').getByRole('button');

/** The "All Programs" link at the top of a program page. */
const backLink = (page: Page): Locator =>
  page.locator('.back').getByRole('link', { name: 'All Programs', exact: true });

const CONNECTED_LINE = `Angular, the API, and SQL Server are connected. Database ${seed.database}, ${seed.programs} programs.`;

/** Opens the All Programs section of the home page and waits for the table and the footer health line. */
async function openList(page: Page): Promise<void> {
  await page.goto('/#all-programs');
  await expect(rows(page)).toHaveCount(seed.programs);
  await expect(footer(page)).toContainText(CONNECTED_LINE);
}

/** Opens a program by its address, with an optional query string, and waits for its heading. */
async function openProgram(page: Page, id: number, name: string, query = ''): Promise<void> {
  await page.goto(`${programUrl(id)}${query}`);
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/**
 * The panel contract: this many chart panels and this many map panels are on
 * the page, and each one leaves "loading" for ready, empty, or error. A map
 * service that is slow or down still passes; a panel that hangs does not.
 */
async function expectPanelsSettled(page: Page, charts: number, maps: number): Promise<void> {
  await expect(chartPanels(page)).toHaveCount(charts);
  await expect(sitesPanels(page)).toHaveCount(maps);
  for (const panel of [...(await chartPanels(page).all()), ...(await sitesPanels(page).all())]) {
    await expect(panel).toHaveAttribute('data-state', /^(ready|empty|error)$/, {
      timeout: PANEL_TIMEOUT_MS,
    });
  }
}

/** How far the page can scroll sideways, in pixels. Zero or less means not at all. */
async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

/** The programs the All Programs list shows with Featured only picked. */
async function featuredRows(page: Page): Promise<Locator> {
  await featuredOnly(page).click();
  await expect(featuredOnly(page)).toHaveAttribute('aria-checked', 'true');
  return rows(page);
}

async function featuredCount(request: APIRequestContext): Promise<number> {
  const programs = (await (await request.get(`${API_URL}/monitoring-programs`)).json()) as {
    IsFeatured: boolean;
  }[];
  return programs.filter((item) => item.IsFeatured).length;
}

async function savedTemplate(request: APIRequestContext, id: number): Promise<Template> {
  const detail = (await (await request.get(apiProgramUrl(id))).json()) as { Template: Template };
  return detail.Template;
}

/** Waits for the next PATCH the page sends for one program. */
function nextPatch(page: Page, id: number) {
  return page.waitForResponse(
    (response) =>
      response.request().method() === 'PATCH' &&
      new URL(response.url()).pathname === `/api/monitoring-programs/${id}`,
  );
}

test.describe('All Programs list', () => {
  test.beforeEach(async ({ page }) => {
    await openList(page);
  });

  test("applies Ecology's default theme, DM Sans, and the page background", async ({ page }) => {
    // No theme attribute: the default theme from tokens.css.
    expect(await page.locator('html').getAttribute('data-theme')).toBeNull();
    await expect(page.locator('body')).toHaveCSS(
      'background-color',
      await resolvedColor(page, '--color-background-default'),
    );
    await expect(page.locator('body')).toHaveCSS('font-family', FONT_PATTERN);

    // The face reaches text in the page, in a table cell, and inside a shadow root.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-family', FONT_PATTERN);
    await expect(rows(page).first().locator('th')).toHaveCSS('font-family', FONT_PATTERN);
    await expect(searchBox(page)).toHaveCSS('font-family', FONT_PATTERN);
    await expect(categorySelect(page)).toHaveCSS('font-family', FONT_PATTERN);

    await expect.poll(() => fontLoaded(page)).toBe(true);
  });

  test('the list is one neutral frame: filters, table, and record count, with no tiles of its own', async ({
    page,
  }) => {
    const frame = page.locator('app-program-list .list-frame');
    await expect(frame).toHaveCSS(
      'background-color',
      await resolvedColor(page, '--color-background-elevation-raised'),
    );
    await expect(frame).toHaveCSS('border-top-color', await resolvedColor(page, '--color-border-default'));
    // The filters, then the table, then the count, in that order inside the one frame.
    const order = await frame.evaluate((root) =>
      [...root.children].map((child) => child.className.split(' ')[0]),
    );
    expect(order).toEqual(['list-frame__filters', 'table-scroll', 'list-frame__count']);
    // The totals live in the header band above; the list repeats none of them.
    await expect(page.locator('app-program-list .esa-stat')).toHaveCount(0);
    await expect(heroTotal(page, 'monitoring programs')).toHaveText(String(seed.programs));
  });

  test('lists all 90 programs', async ({ page }) => {
    await expect(rows(page)).toHaveCount(seed.programs);
    await expect(resultCount(page)).toHaveText(`Showing ${seed.programs} of ${seed.programs}`);
    await expect(page.locator('table.programs-table thead th')).toHaveText([
      'Program',
      'Category',
      'Layout',
      'Partners',
      'Featured',
    ]);
    await expect(page.getByRole('link', { name: seed.ozone.name, exact: true })).toHaveAttribute(
      'href',
      programUrl(seed.ozone.id),
    );
  });

  test('each row shows the layout as a badge', async ({ page }) => {
    const layouts = await rows(page).locator(LAYOUT_CELL).allTextContents();
    const count = (label: string): number =>
      layouts.filter((text) => text.trim() === label).length;

    expect(layouts).toHaveLength(seed.programs);
    expect({ map: count('Map'), charts: count('Charts'), context: count('Content') }).toEqual(
      seed.templates,
    );
    // The stored word "context" is never shown; the reader sees "Content".
    await expect(rowOf(page, seed.ozone.name).locator(LAYOUT_CELL)).toHaveText('Charts');
    await expect(rowOf(page, seed.yellowCress.name).locator(LAYOUT_CELL)).toHaveText('Map');
    await expect(rowOf(page, seed.socioEconomic.name).locator(LAYOUT_CELL)).toHaveText('Content');
    await expect(rowOf(page, seed.ozone.name).locator(`${LAYOUT_CELL} .esa-badge`)).toHaveCount(1);
    // Quiet badges: the neutral variant, never a color.
    await expect(rows(page).locator('.esa-badge:not(.esa-badge--neutral)')).toHaveCount(0);
  });

  test('the category column is plain text, with no badge and no category color', async ({ page }) => {
    await expect(rowOf(page, seed.ozone.name).locator(CATEGORY_CELL)).toHaveText(seed.ozone.category);
    await expect(rows(page).locator(`${CATEGORY_CELL} .esa-badge`)).toHaveCount(0);
    await expect(page.locator('.category-tint, [style*="--category-color"]')).toHaveCount(0);
    // Every category cell is drawn in the same text color.
    const colors = await rows(page)
      .locator(CATEGORY_CELL)
      .evaluateAll((cells) => cells.map((cell) => getComputedStyle(cell).color));
    expect(new Set(colors).size).toBe(1);
  });

  test('each row shows a key photo thumbnail, or a neutral frame when there is none', async ({
    page,
    request,
  }) => {
    const programs = (await (await request.get(`${API_URL}/monitoring-programs`)).json()) as {
      MonitoringProgramID: number;
      KeyPhotoUrl: string | null;
    }[];
    const ozone = programs.find((item) => item.MonitoringProgramID === seed.ozone.id)!;

    // Every row has the thumbnail box; 39 of them hold a photo.
    await expect(rows(page).locator('.thumb')).toHaveCount(seed.programs);
    await expect(rows(page).locator('img.thumb__img')).toHaveCount(seed.programsWithPhotos);

    // A program with a photo: its key photo, loaded lazily, decorative beside the link.
    const thumb = rowOf(page, seed.ozone.name).locator('img.thumb__img');
    await expect(thumb).toHaveAttribute('src', ozone.KeyPhotoUrl!);
    await expect(thumb).toHaveAttribute('loading', 'lazy');
    await expect(thumb).toHaveAttribute('alt', '');
    await thumb.scrollIntoViewIfNeeded();
    await expect
      .poll(() => thumb.evaluate((img: HTMLImageElement) => img.naturalWidth), { timeout: 30_000 })
      .toBeGreaterThan(0);

    // A program without one: the box is there, with no image in it, in the neutral well
    // color and with no colored edge.
    const empty = rowOf(page, seed.standComposition.name);
    await expect(empty.locator('.thumb')).toHaveCount(1);
    await expect(empty.locator('img')).toHaveCount(0);
    await expect(empty.locator('.thumb')).toHaveCSS(
      'background-color',
      await resolvedColor(page, '--color-background-elevation-sunken'),
    );
    await expect(empty.locator('.thumb')).toHaveCSS('border-left-width', '0px');
  });

  test('footer says Angular, the API, and SQL Server are connected', async ({ page }) => {
    await expect(footer(page)).toContainText('Connected');
    await expect(footer(page)).toContainText(CONNECTED_LINE);
  });

  test('search for "ozone" narrows the table to one row', async ({ page }) => {
    await searchBox(page).fill('ozone');

    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(seed.ozone.name);
    await expect(resultCount(page)).toHaveText(`Showing 1 of ${seed.programs}`);

    // Clearing the box brings every row back.
    await searchBox(page).fill('');
    await expect(rows(page)).toHaveCount(seed.programs);
  });

  test('category filter shows the 5 Air Quality programs', async ({ page }) => {
    await categorySelect(page).click();
    await page.getByRole('option', { name: /^Air Quality/ }).click();

    await expect(rows(page)).toHaveCount(seed.airQualityPrograms);
    await expect(rows(page).locator(CATEGORY_CELL)).toHaveText(
      Array.from({ length: seed.airQualityPrograms }, () => seed.ozone.category),
    );
    await expect(categorySelect(page)).toContainText(seed.ozone.category);
  });

  test('layout filter shows the 10 Content programs, then the 35 Map programs', async ({ page }) => {
    await layoutSelect(page).click();
    // Each option carries its count.
    await expect(page.getByRole('option', { name: `Map (${seed.templates.map})` })).toBeVisible();
    await expect(
      page.getByRole('option', { name: `Charts (${seed.templates.charts})` }),
    ).toBeVisible();
    await page.getByRole('option', { name: `Content (${seed.templates.context})` }).click();

    await expect(rows(page)).toHaveCount(seed.templates.context);
    await expect(rows(page).locator(LAYOUT_CELL)).toHaveText(
      Array.from({ length: seed.templates.context }, () => 'Content'),
    );
    await expect(resultCount(page)).toHaveText(
      `Showing ${seed.templates.context} of ${seed.programs}`,
    );
    await expect(rowOf(page, seed.standComposition.name)).toHaveCount(1);
    await expect(rowOf(page, seed.ozone.name)).toHaveCount(0);

    await layoutSelect(page).click();
    await page.getByRole('option', { name: `Map (${seed.templates.map})` }).click();
    await expect(rows(page)).toHaveCount(seed.templates.map);
    await expect(rowOf(page, seed.yellowCress.name)).toHaveCount(1);

    // Back to every layout.
    await layoutSelect(page).click();
    await page.getByRole('option', { name: 'All layouts' }).click();
    await expect(rows(page)).toHaveCount(seed.programs);
  });

  test('the layout filter works together with search, category, and featured', async ({
    page,
    request,
  }) => {
    const programs = (await (await request.get(`${API_URL}/monitoring-programs`)).json()) as {
      MonitoringProgramName: string;
      CategoryName: string;
      IsFeatured: boolean;
      Template: Template;
    }[];
    const charts = programs.filter((item) => item.Template === 'charts');
    const featuredCharts = charts.filter((item) => item.IsFeatured);
    const airQualityCharts = charts.filter((item) => item.CategoryName === seed.ozone.category);

    await layoutSelect(page).click();
    await page.getByRole('option', { name: `Charts (${seed.templates.charts})` }).click();
    await expect(rows(page)).toHaveCount(seed.templates.charts);

    // With Featured only.
    await featuredOnly(page).click();
    await expect(rows(page)).toHaveCount(featuredCharts.length);
    await allPrograms(page).click();

    // With a category.
    await categorySelect(page).click();
    await page.getByRole('option', { name: /^Air Quality/ }).click();
    await expect(rows(page)).toHaveCount(airQualityCharts.length);

    // With a search, all three filters at once.
    await searchBox(page).fill('ozone');
    await expect(rows(page)).toHaveCount(1);
    await expect(rows(page).first()).toContainText(seed.ozone.name);

    // A layout the match does not use leaves nothing, and Clear filters resets all four.
    await layoutSelect(page).click();
    await page.getByRole('option', { name: `Map (${seed.templates.map})` }).click();
    await expect(page.getByRole('heading', { name: 'No programs match' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(rows(page)).toHaveCount(seed.programs);
    await expect(searchBox(page)).toHaveValue('');
  });

  test('featured only shows the 17 featured programs', async ({ page }) => {
    await featuredOnly(page).click();

    await expect(featuredOnly(page)).toHaveAttribute('aria-checked', 'true');
    await expect(rows(page)).toHaveCount(seed.featured);
    await expect(rows(page).locator(FEATURED_CELL)).toHaveText(
      Array.from({ length: seed.featured }, () => 'Featured'),
    );
    await expect(resultCount(page)).toHaveText(`Showing ${seed.featured} of ${seed.programs}`);

    await allPrograms(page).click();
    await expect(rows(page)).toHaveCount(seed.programs);
  });

  test('a search with no match shows the empty state, and Clear filters recovers', async ({
    page,
  }) => {
    await searchBox(page).fill('zzzz-no-match');

    await expect(page.getByRole('heading', { name: 'No programs match' })).toBeVisible();
    await expect(page.getByText('Clear the filters to see every program.')).toBeVisible();
    await expect(page.locator('table.programs-table')).toHaveCount(0);
    await expect(resultCount(page)).toHaveText(`Showing 0 of ${seed.programs}`);

    await page.getByRole('button', { name: 'Clear filters' }).click();
    await expect(rows(page)).toHaveCount(seed.programs);
    await expect(searchBox(page)).toHaveValue('');
  });

  test('a program link opens its detail page without a full page load', async ({ page }) => {
    // A marker on window survives a client-side route change and nothing else.
    await page.evaluate(() => {
      (window as unknown as { e2eMarker?: boolean }).e2eMarker = true;
    });

    await page.getByRole('link', { name: seed.ozone.name, exact: true }).click();

    await expect(page).toHaveURL(new RegExp(`${programUrl(seed.ozone.id)}$`));
    await expect(page.getByRole('heading', { level: 1, name: seed.ozone.name })).toBeVisible();
    expect(
      await page.evaluate(() => (window as unknown as { e2eMarker?: boolean }).e2eMarker),
    ).toBe(true);
  });
});

test.describe('Program page, shared parts', () => {
  test('program 41 shows Ozone with its category, tiles, story, 6 partners, and Featured card', async ({
    page,
  }) => {
    // Opened by address: on the nginx build this also proves the SPA fallback.
    await openProgram(page, seed.ozone.id, seed.ozone.name);

    // The shared header: the name, the category as a quiet neutral badge, four tiles.
    const categoryBadge = header(page).locator('.head__badges .esa-badge').first();
    await expect(categoryBadge).toHaveText(seed.ozone.category);
    await expect(categoryBadge).toHaveClass(/esa-badge--neutral/);
    await expect(header(page).locator('.esa-badge:not(.esa-badge--neutral)')).toHaveCount(0);
    // A neutral card: the top edge is the same hairline as the others, not a category rule.
    const head = header(page).locator('.head');
    const edges = await head.evaluate((element) => {
      const style = getComputedStyle(element);
      return {
        top: `${style.borderTopWidth} ${style.borderTopColor}`,
        bottom: `${style.borderBottomWidth} ${style.borderBottomColor}`,
      };
    });
    expect(edges.top).toBe(edges.bottom);
    await expect(page.locator('.category-tint, [style*="--category-color"]')).toHaveCount(0);
    await expect(tiles(page).locator('.esa-stat__label')).toHaveText([
      'Total sites',
      'Active sites',
      'Record began',
      'Latest data',
    ]);

    // The story: Ozone has no description, so the card holds the monitoring approach.
    await expect(page.locator('.prose')).toContainText('Ozone is monitored');
    await expect(page.getByRole('heading', { name: 'Monitoring Approach', exact: true })).toBeVisible();

    await expect(partnerItems(page)).toHaveCount(seed.ozone.partners);
    await expect(partnerItems(page).first()).toHaveText('Tahoe Regional Planning Agency (TRPA)');

    // The Featured card keeps the write path.
    await expect(savedValue(page)).toHaveText('Saved value: Not featured');
    await expect(featuredButton(page)).toHaveText('Mark as featured');
    await expect(backLink(page)).toHaveAttribute('href', '/#all-programs');
  });

  test('the summary tiles fill in from the panels', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 2);
    await openProgram(page, seed.ozone.id, seed.ozone.name);
    await expectPanelsSettled(page, seed.ozone.chartPanels, seed.ozone.sitesPanels);

    // Once every panel has settled, no tile is still waiting: each shows a number or "n/a".
    await expect(tiles(page).locator('.esa-stat__value')).toHaveText([
      /^(\d[\d,]*|n\/a)$/,
      /^(\d[\d,]*|n\/a)$/,
      /^(\d{4}|n\/a)$/,
      /^(\d{4}|n\/a)$/,
    ]);
  });

  test('the featured button saves through the API and is restored afterward', async ({
    page,
    request,
  }) => {
    const { id, name } = seed.ozone;
    const original = (await (await request.get(apiProgramUrl(id))).json()) as {
      IsFeatured: boolean;
    };
    const featuredBefore = await featuredCount(request);
    const label = (isFeatured: boolean): string => (isFeatured ? 'Featured' : 'Not featured');
    const action = (isFeatured: boolean): string =>
      isFeatured ? 'Remove from featured' : 'Mark as featured';

    try {
      await openProgram(page, id, name);
      await expect(savedValue(page)).toHaveText(`Saved value: ${label(original.IsFeatured)}`);
      await expect(featuredButton(page)).toHaveText(action(original.IsFeatured));

      // First click: the page sends PATCH and shows what the API sent back.
      let patched = nextPatch(page, id);
      await featuredButton(page).click();
      const firstPatch = await patched;
      expect(firstPatch.status()).toBe(200);
      expect(firstPatch.request().postDataJSON()).toEqual({ IsFeatured: !original.IsFeatured });
      await expect(savedValue(page)).toHaveText(`Saved value: ${label(!original.IsFeatured)}`);
      await expect(featuredButton(page)).toHaveText(action(!original.IsFeatured));
      await expect(featuredButton(page)).toBeEnabled();
      // The header badge follows the saved value.
      await expect(header(page).getByText('Featured', { exact: true })).toHaveCount(
        original.IsFeatured ? 0 : 1,
      );

      // The value is in SQL Server, not only on the page: the API agrees, and a
      // fresh load of the list shows one more (or one fewer) featured program.
      const saved = (await (await request.get(apiProgramUrl(id))).json()) as {
        IsFeatured: boolean;
      };
      expect(saved.IsFeatured).toBe(!original.IsFeatured);
      const featuredAfter = featuredBefore + (original.IsFeatured ? -1 : 1);
      await openList(page);
      await expect(await featuredRows(page)).toHaveCount(featuredAfter);
      await expect(rowOf(page, name)).toHaveCount(original.IsFeatured ? 0 : 1);

      // Second click, on a fresh load of the detail page: back to the original.
      await openProgram(page, id, name);
      await expect(savedValue(page)).toHaveText(`Saved value: ${label(!original.IsFeatured)}`);
      patched = nextPatch(page, id);
      await featuredButton(page).click();
      expect((await patched).status()).toBe(200);
      await expect(savedValue(page)).toHaveText(`Saved value: ${label(original.IsFeatured)}`);
      await expect(featuredButton(page)).toHaveText(action(original.IsFeatured));
    } finally {
      // Leave the database as found, even when a step above failed.
      const restore = await request.patch(apiProgramUrl(id), {
        data: { IsFeatured: original.IsFeatured },
      });
      expect(restore.status(), 'restoring the original IsFeatured value').toBe(200);
    }

    expect(await featuredCount(request)).toBe(featuredBefore);
  });

  test.describe('unknown id', () => {
    // The browser writes its own console line when a fetch comes back 404. The
    // app asked for that program on purpose, so the line is expected here and
    // nowhere else.
    const expected404 = new RegExp(
      `status of 404 .*/api/monitoring-programs/${seed.unknownId}\\]$`,
    );
    test.use({ allowedConsoleErrors: [expected404] });

    test('an unknown id says no monitoring program has that ID', async ({
      page,
      consoleErrors,
    }) => {
      await page.goto(programUrl(seed.unknownId));

      await expect(
        page.getByRole('heading', { name: `No monitoring program has ID ${seed.unknownId}` }),
      ).toBeVisible();
      await expect(page.getByText('Go back to the list and pick a program.')).toBeVisible();
      await expect(page.locator('.featured')).toHaveCount(0);
      await expect(program(page)).toHaveCount(0);
      await expect(saveLayout(page)).toHaveCount(0);
      // The rest of the app is fine: the shell and the health line still show.
      await expect(footer(page)).toContainText(CONNECTED_LINE);

      expect(consoleErrors).toHaveLength(1);
      expect(consoleErrors[0]).toMatch(expected404);

      await backLink(page).click();
      await expect(page).toHaveURL(/\/#all-programs$/);
      await expect(rows(page)).toHaveCount(seed.programs);
    });
  });
});

test.describe('The three templates', () => {
  test('program 39 uses the map template: the map leads, then the charts', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 2);
    const { id, name, chartPanels: charts, sitesPanels: maps } = seed.yellowCress;
    await openProgram(page, id, name);

    await expect(program(page)).toHaveAttribute('data-template', 'map');
    await expect(page.locator('app-map-template')).toHaveCount(1);
    await expect(page.locator('app-charts-template, app-content-template')).toHaveCount(0);
    await expect(layoutRadio(page, 'map')).toHaveAttribute('aria-checked', 'true');

    // Order: sites, measurements, about, photos.
    await expect(sections(page)).toHaveCount(4);
    expect(
      await sections(page).evaluateAll((list) => list.map((el) => el.getAttribute('data-section'))),
    ).toEqual(['sites', 'measurements', 'about', 'photos']);

    // The lead: the map panel is the first panel on the page, straight under the header.
    await expect(sections(page).first().locator('app-sites-panel')).toHaveCount(1);
    const headerBox = (await header(page).boundingBox())!;
    const mapBox = (await sitesPanels(page).first().boundingBox())!;
    const firstChartBox = (await chartPanels(page).first().boundingBox())!;
    expect(mapBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
    expect(mapBox.y).toBeLessThan(firstChartBox.y);
    // Wide: the map takes the full width of the page column, as the header does.
    expect(Math.abs(mapBox.width - headerBox.width)).toBeLessThanOrEqual(1);

    await expectPanelsSettled(page, charts, maps);
  });

  test('program 41 uses the charts template: the charts lead, then the map', async ({ page }) => {
    test.setTimeout(PANEL_TIMEOUT_MS * 2);
    const { id, name, chartPanels: charts, sitesPanels: maps } = seed.ozone;
    await openProgram(page, id, name);

    await expect(program(page)).toHaveAttribute('data-template', 'charts');
    await expect(page.locator('app-charts-template')).toHaveCount(1);
    await expect(page.locator('app-map-template, app-content-template')).toHaveCount(0);
    await expect(layoutRadio(page, 'charts')).toHaveAttribute('aria-checked', 'true');

    // Order: measurements, sites, about. One photo, so no Photos section.
    expect(
      await sections(page).evaluateAll((list) => list.map((el) => el.getAttribute('data-section'))),
    ).toEqual(['measurements', 'sites', 'about']);

    // The lead: the measurement charts come first; the map and the per-year chart follow.
    const lead = sections(page).first();
    await expect(lead.locator('app-chart-panel')).toHaveCount(charts - 1);
    await expect(sections(page).nth(1).locator('app-sites-panel')).toHaveCount(maps);
    await expect(sections(page).nth(1).locator('app-chart-panel')).toHaveCount(1);
    const headerBox = (await header(page).boundingBox())!;
    const firstChartBox = (await chartPanels(page).first().boundingBox())!;
    const mapBox = (await sitesPanels(page).first().boundingBox())!;
    expect(firstChartBox.y).toBeGreaterThanOrEqual(headerBox.y + headerBox.height);
    expect(firstChartBox.y).toBeLessThan(mapBox.y);

    await expectPanelsSettled(page, charts, maps);
  });

  test('program 68 uses the content template: the story leads, with no empty data sections', async ({
    page,
  }) => {
    const { id, name } = seed.socioEconomic;
    await openProgram(page, id, name);

    await expect(program(page)).toHaveAttribute('data-template', 'context');
    await expect(page.locator('app-content-template')).toHaveCount(1);
    await expect(page.locator('app-map-template, app-charts-template')).toHaveCount(0);
    await expect(layoutRadio(page, 'context')).toHaveAttribute('aria-checked', 'true');

    // The story leads: the first paragraph of the description sits in the header
    // as the lead, and the first section is the story.
    await expect(header(page).locator('.lead')).toContainText('TRPA monitors socio-economic data');
    expect(
      await sections(page).evaluateAll((list) => list.map((el) => el.getAttribute('data-section'))),
    ).toEqual(['about']);
    await expect(sections(page).first().locator('.prose')).toContainText('U.S. Census Bureau');

    // Nothing is configured for charts or a map, so those sections are left out,
    // not shown empty.
    await expectPanelsSettled(page, 0, 0);
    await expect(page.getByRole('heading', { name: 'Measurements' })).toHaveCount(0);
    await expect(page.getByText('No measurements loaded yet')).toHaveCount(0);
    await expect(page.getByText('No sites loaded yet')).toHaveCount(0);

    // Every tile would read n/a, so there are none.
    await expect(tiles(page)).toHaveCount(0);

    // No partners: the house empty state, what is absent and what the section will show.
    await expect(page.getByRole('heading', { name: 'No partners loaded yet' })).toBeVisible();
    await expect(
      page.getByText('This section will show the partner organizations from Lake Tahoe Info.'),
    ).toBeVisible();
  });

  test('program 9681 has no photo: the header text takes the full width, and nothing is broken', async ({
    page,
  }) => {
    const { id, name } = seed.standComposition;
    await openProgram(page, id, name);

    await expect(program(page)).toHaveAttribute('data-template', 'context');
    await expect(header(page)).toHaveAttribute('data-photo', 'none');
    // No empty frame leads the content layout: the text takes the whole header.
    await expect(banner(page)).toHaveCount(0);
    const text = (await header(page).locator('.head__text').boundingBox())!;
    const card = (await header(page).locator('.head').boundingBox())!;
    expect(Math.abs(text.width - (card.width - 2))).toBeLessThanOrEqual(1);

    // No image, no gallery, no photo button: nothing to be broken or empty.
    await expect(program(page).locator('img')).toHaveCount(0);
    await expect(heroButton(page)).toHaveCount(0);
    await expect(page.locator('app-photo-gallery')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Photos' })).toHaveCount(0);

    // The rest of the content layout is there. A first paragraph this long stays in the story
    // rather than leading in the header.
    await expect(header(page).locator('.lead')).toHaveCount(0);
    await expect(sections(page).first().locator('.prose')).toContainText('stand composition and age management standard');
    await expect(sections(page).first().locator('.prose')).toContainText('proper juxtaposition of vegetation communities');
    await expectPanelsSettled(page, seed.standComposition.chartPanels, 0);
  });

  test('a map or charts layout with nothing configured shows the house empty states', async ({
    page,
  }) => {
    // Instream Flow has no chart or map settings. Previewed in the charts
    // layout, each data section says what is absent and what it will show.
    const { id, name } = seed.instreamFlow;
    await openProgram(page, id, name, '?template=charts');

    await expect(program(page)).toHaveAttribute('data-template', 'charts');
    for (const [title, description] of [
      ['No measurements loaded yet', 'This section will show measurement charts'],
      ['No sites loaded yet', 'This section will show a map of the monitoring sites'],
      ['No site records loaded yet', 'This section will show how many sites were monitored'],
    ]) {
      await expect(page.getByRole('heading', { name: title })).toBeVisible();
      await expect(page.getByText(description)).toBeVisible();
    }
    await expectPanelsSettled(page, 0, 0);
  });
});

test.describe('Photos', () => {
  test('the key photo of program 41 loads, with its caption, credit, and alt text', async ({
    page,
    request,
  }) => {
    const detail = (await (await request.get(apiProgramUrl(seed.ozone.id))).json()) as {
      Images: { Url: string; Caption: string; PhotoCredit: string }[];
    };
    const keyPhoto = detail.Images[0];
    await openProgram(page, seed.ozone.id, seed.ozone.name);

    await expect(header(page)).toHaveAttribute('data-photo', 'shown');
    await expect(heroImage(page)).toHaveAttribute('src', keyPhoto.Url);
    await expect(heroImage(page)).toHaveAttribute('alt', keyPhoto.Caption);
    // The file really arrived and decoded.
    await expect
      .poll(() => heroImage(page).evaluate((img: HTMLImageElement) => img.naturalWidth), {
        timeout: 30_000,
      })
      .toBeGreaterThan(0);

    const caption = header(page).locator('figcaption');
    await expect(caption).toContainText(keyPhoto.Caption);
    await expect(caption).toContainText(`Photo: ${keyPhoto.PhotoCredit}`);

    // One photo: it is shown in the header, and there is no gallery to be empty.
    await expect(galleryButtons(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Photos' })).toHaveCount(0);
  });

  test('program 39 shows its other three photos in a gallery, lazily, with captions', async ({
    page,
    request,
  }) => {
    const detail = (await (await request.get(apiProgramUrl(seed.yellowCress.id))).json()) as {
      Images: { Url: string; Caption: string | null }[];
    };
    const others = detail.Images.slice(1);
    await openProgram(page, seed.yellowCress.id, seed.yellowCress.name);

    await expect(page.getByRole('heading', { name: 'Photos' })).toBeVisible();
    await expect(galleryButtons(page)).toHaveCount(seed.yellowCress.photos - 1);
    const images = galleryButtons(page).locator('img');
    for (const [index, photo] of others.entries()) {
      await expect(images.nth(index)).toHaveAttribute('src', photo.Url);
      await expect(images.nth(index)).toHaveAttribute('loading', 'lazy');
      await expect(images.nth(index)).toHaveAttribute('alt', photo.Caption ?? /.+/);
    }
    await expect(page.locator('app-photo-gallery figcaption')).toHaveCount(others.length);

    // Every frame has its 4 to 3 box before its file arrives, so nothing moves on load.
    const box = (await galleryButtons(page).first().boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(4 / 3, 1);
  });

  test('the larger view opens and closes by keyboard', async ({ page }) => {
    const total = seed.yellowCress.photos;
    await openProgram(page, seed.yellowCress.id, seed.yellowCress.name);
    await expect(lightbox(page)).toBeHidden();

    // Enter on the second gallery photo opens the dialog on that photo.
    const trigger = galleryButtons(page).nth(1);
    await trigger.focus();
    await page.keyboard.press('Enter');
    await expect(lightbox(page)).toBeVisible();
    await expect(page.getByRole('dialog', { name: `Photo 3 of ${total}` })).toBeVisible();
    // Focus moved into the dialog.
    await expect(lightbox(page).getByRole('button', { name: 'Close' })).toBeFocused();

    // The arrow keys page through every photo, the key photo included, and wrap.
    await page.keyboard.press('ArrowRight');
    await expect(lightbox(page).getByRole('heading')).toHaveText(`Photo 4 of ${total}`);
    await page.keyboard.press('ArrowRight');
    await expect(lightbox(page).getByRole('heading')).toHaveText(`Photo 1 of ${total}`);
    await page.keyboard.press('ArrowLeft');
    await expect(lightbox(page).getByRole('heading')).toHaveText(`Photo 4 of ${total}`);

    // Tab stays inside the dialog: the page behind it cannot take focus.
    for (let presses = 0; presses < 6; presses += 1) {
      await page.keyboard.press('Tab');
      expect(
        await page.evaluate(() => {
          const focused = document.activeElement;
          return focused === document.body || focused?.closest('dialog') !== null;
        }),
        'focus is in the dialog, or on nothing, and never on the page behind it',
      ).toBe(true);
    }

    // Escape closes it, and focus returns to the photo that opened it.
    await page.keyboard.press('Escape');
    await expect(lightbox(page)).toBeHidden();
    await expect(trigger).toBeFocused();

    // The key photo opens the same dialog, and the Close button closes it.
    await heroButton(page).focus();
    await page.keyboard.press('Enter');
    await expect(lightbox(page).getByRole('heading')).toHaveText(`Photo 1 of ${total}`);
    await page.keyboard.press('Enter');
    await expect(lightbox(page)).toBeHidden();
    await expect(heroButton(page)).toBeFocused();
  });

  test.describe('a photo that does not load', () => {
    // The browser logs the failed image request. It is expected here only.
    test.use({ allowedConsoleErrors: [/net::ERR_FAILED/] });

    test('falls back to a neutral well in the photo slot', async ({ page, request }) => {
      const detail = (await (await request.get(apiProgramUrl(seed.ozone.id))).json()) as {
        Images: { Url: string }[];
      };
      const keyPhotoUrl = detail.Images[0].Url;
      await page.route(keyPhotoUrl, (route) => route.abort('failed'));

      await openProgram(page, seed.ozone.id, seed.ozone.name);

      await expect(header(page)).toHaveAttribute('data-photo', 'failed');
      await expect(banner(page)).toBeVisible();
      await expect(banner(page)).toHaveText('The program photo could not be loaded');
      // A neutral well in the photo's place beside the text, so the band keeps its shape.
      await expect(banner(page).locator('.banner')).toHaveCSS(
        'background-color',
        await resolvedColor(page, '--color-background-elevation-sunken'),
      );
      const well = (await banner(page).boundingBox())!;
      const text = (await header(page).locator('.head__text').boundingBox())!;
      expect(well.x).toBeGreaterThanOrEqual(text.x + text.width - 1);
      // No broken image is left behind, and there is nothing to open.
      await expect(header(page).locator('img')).toHaveCount(0);
      await expect(heroButton(page)).toHaveCount(0);
      // The rest of the header is unharmed.
      await expect(tiles(page)).toHaveCount(4);
    });
  });
});

test.describe('Page layout', () => {
  test('?template= previews another layout without saving it', async ({ page, request }) => {
    const { id, name } = seed.ozone;
    const saved = await savedTemplate(request, id);
    expect(saved, 'program 41 is seeded with the charts layout').toBe('charts');
    let patches = 0;
    page.on('request', (sent) => {
      if (sent.method() === 'PATCH') patches += 1;
    });

    await openProgram(page, id, name, '?template=map');

    // The map layout is on screen, and the page says it is a preview.
    await expect(program(page)).toHaveAttribute('data-template', 'map');
    await expect(page.locator('app-map-template')).toHaveCount(1);
    await expect(layoutRadio(page, 'map')).toHaveAttribute('aria-checked', 'true');
    await expect(previewNotice(page)).toBeVisible();
    await expect(previewNotice(page)).toContainText('Preview');
    await expect(previewNotice(page)).toContainText(
      'This is the Map layout. The saved layout is Charts, and nothing changes until you save.',
    );
    await expect(saveLayout(page)).toBeEnabled();

    // The control tries the third layout, through the address.
    await layoutRadio(page, 'context').click();
    await expect(page).toHaveURL(/[?&]template=context$/);
    await expect(program(page)).toHaveAttribute('data-template', 'context');
    await expect(previewNotice(page)).toContainText('This is the Content layout.');

    // Back to the saved layout: the parameter leaves the address and the notice goes.
    await page.getByRole('button', { name: 'Back to the saved layout' }).click();
    await expect(page).toHaveURL(new RegExp(`${programUrl(id)}$`));
    await expect(program(page)).toHaveAttribute('data-template', 'charts');
    await expect(previewNotice(page)).toBeHidden();
    await expect(saveLayout(page)).toBeDisabled();

    // Nothing was sent, and the database still holds the saved layout.
    expect(patches).toBe(0);
    expect(await savedTemplate(request, id)).toBe(saved);
  });

  test('?template= with the saved layout, or an unknown word, is not a preview', async ({
    page,
  }) => {
    const { id, name } = seed.ozone;

    await openProgram(page, id, name, '?template=charts');
    await expect(program(page)).toHaveAttribute('data-template', 'charts');
    await expect(previewNotice(page)).toBeHidden();
    await expect(saveLayout(page)).toBeDisabled();

    await openProgram(page, id, name, '?template=grid');
    await expect(program(page)).toHaveAttribute('data-template', 'charts');
    await expect(previewNotice(page)).toBeHidden();
    await expect(saveLayout(page)).toBeDisabled();
  });

  test('Save layout stores the layout on screen, and it is restored afterward', async ({
    page,
    request,
  }) => {
    const { id, name } = seed.ozone;
    const original = await savedTemplate(request, id);
    const target: Template = original === 'map' ? 'charts' : 'map';

    try {
      await openProgram(page, id, name);
      await expect(program(page)).toHaveAttribute('data-template', original);
      await expect(saveLayout(page)).toBeDisabled();

      // Pick another layout: a preview, with Save now offered.
      await layoutRadio(page, target).click();
      await expect(program(page)).toHaveAttribute('data-template', target);
      await expect(previewNotice(page)).toBeVisible();
      expect(await savedTemplate(request, id), 'a preview saves nothing').toBe(original);

      // Save: the page sends PATCH with the layout on screen.
      const patched = nextPatch(page, id);
      await saveLayout(page).click();
      const patch = await patched;
      expect(patch.status()).toBe(200);
      expect(patch.request().postDataJSON()).toEqual({ Template: target });

      // It is now the saved layout: no notice, no parameter, nothing left to save.
      await expect(previewNotice(page)).toBeHidden();
      await expect(saveLayout(page)).toBeDisabled();
      await expect(page).toHaveURL(new RegExp(`${programUrl(id)}$`));
      await expect(program(page)).toHaveAttribute('data-template', target);
      expect(await savedTemplate(request, id)).toBe(target);

      // A fresh load, with no parameter, opens in the stored layout.
      await openProgram(page, id, name);
      await expect(program(page)).toHaveAttribute('data-template', target);
      await expect(layoutRadio(page, target)).toHaveAttribute('aria-checked', 'true');
      await expect(previewNotice(page)).toBeHidden();

      // The list shows it too.
      await openList(page);
      await expect(rowOf(page, name).locator(LAYOUT_CELL)).toHaveText(TEMPLATE_LABELS[target]);
    } finally {
      // Leave the database as found, even when a step above failed.
      const restore = await request.patch(apiProgramUrl(id), { data: { Template: original } });
      expect(restore.status(), 'restoring the original Template value').toBe(200);
    }

    expect(await savedTemplate(request, id)).toBe(original);
  });
});

test.describe('API down', () => {
  // Every aborted request is logged by the browser as a failed resource.
  test.use({ allowedConsoleErrors: [/net::ERR_CONNECTION_REFUSED/] });

  test('the home page shows the error state, and Try again recovers', async ({ page }) => {
    const isApiCall = (url: URL): boolean => url.pathname.startsWith('/api/');
    await page.route(isApiCall, (route) => route.abort('connectionrefused'));

    await page.goto('/#all-programs');

    await expect(page.getByRole('heading', { name: 'The API did not respond' })).toBeVisible();
    await expect(
      page.getByText('Start the sandbox.api container, then try again.'),
    ).toBeVisible();
    await expect(page.locator('table.programs-table')).toHaveCount(0);
    await expect(page.locator('app-category-card')).toHaveCount(0);
    // An error state, not a blank page: the header, the hero, and the footer still render.
    await expect(page.getByRole('heading', { level: 1, name: 'Monitoring Programs' })).toBeVisible();
    await expect(page.locator('.app-bar')).toContainText('Lake Tahoe Info');
    await expect(footer(page)).toContainText('Not connected');

    await page.unroute(isApiCall);
    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(rows(page)).toHaveCount(seed.programs);
    await expect(heroTotal(page, 'monitoring programs')).toHaveText(String(seed.programs));
    await expect(page.locator('app-category-card')).toHaveCount(seed.categories);
  });

  test('a program page shows the error state, with no template and no controls', async ({
    page,
  }) => {
    const isApiCall = (url: URL): boolean => url.pathname.startsWith('/api/');
    await page.route(isApiCall, (route) => route.abort('connectionrefused'));

    await page.goto(programUrl(seed.ozone.id));

    await expect(page.getByRole('heading', { name: 'The API did not respond' })).toBeVisible();
    await expect(program(page)).toHaveCount(0);
    await expect(saveLayout(page)).toHaveCount(0);
    await expect(backLink(page)).toBeVisible();
  });
});

test.describe('At 375 px wide', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('the All Programs list does not scroll sideways', async ({ page }) => {
    await openList(page);

    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);

    // The wide table scrolls inside its own region instead of widening the page.
    const tableRegion = page.locator('.table-scroll');
    const regionBox = await tableRegion.boundingBox();
    expect(regionBox).not.toBeNull();
    expect(regionBox!.x + regionBox!.width).toBeLessThanOrEqual(375);
  });

  for (const target of [
    { ...seed.yellowCress, charts: seed.yellowCress.chartPanels, maps: seed.yellowCress.sitesPanels },
    { ...seed.ozone, charts: seed.ozone.chartPanels, maps: seed.ozone.sitesPanels },
    { ...seed.socioEconomic, charts: 0, maps: 0 },
    { ...seed.standComposition, charts: seed.standComposition.chartPanels, maps: 0 },
  ]) {
    test(`the ${TEMPLATE_LABELS[target.template]} layout of program ${target.id} does not scroll sideways`, async ({
      page,
    }) => {
      test.setTimeout(PANEL_TIMEOUT_MS * 2);
      await openProgram(page, target.id, target.name);
      await expect(program(page)).toHaveAttribute('data-template', target.template);
      // Measured once the panels have drawn, since a chart or a map could be what overflows.
      await expectPanelsSettled(page, target.charts, target.maps);

      expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);

      // Everything is one column: the header and each section fit inside the viewport.
      for (const box of [header(page), ...(await sections(page).all())]) {
        const bounds = (await box.boundingBox())!;
        expect(bounds.x).toBeGreaterThanOrEqual(0);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(375);
      }
      // The tiles shown (those with something to report) reflow to two across.
      const tileBoxes = await Promise.all((await tiles(page).all()).map((tile) => tile.boundingBox()));
      if (tileBoxes.length >= 2) expect(tileBoxes[0]!.y).toBe(tileBoxes[1]!.y);
      if (tileBoxes.length >= 3) expect(tileBoxes[2]!.y).toBeGreaterThan(tileBoxes[0]!.y);
    });
  }

  test('the larger view of a photo fits the screen', async ({ page }) => {
    await openProgram(page, seed.yellowCress.id, seed.yellowCress.name);
    await heroButton(page).click();

    await expect(lightbox(page)).toBeVisible();
    const panel = (await lightbox(page).locator('.lightbox__panel').boundingBox())!;
    expect(panel.x).toBeGreaterThanOrEqual(0);
    expect(panel.x + panel.width).toBeLessThanOrEqual(375);
    expect(panel.y + panel.height).toBeLessThanOrEqual(800);
    await page.keyboard.press('Escape');
    await expect(lightbox(page)).toBeHidden();
  });
});

test.describe('Console on a clean load', () => {
  test('the All Programs list logs no errors', async ({ page, consoleErrors }) => {
    await openList(page);
    await expect(page.locator('app-home-map')).toHaveAttribute('data-state', 'ready', {
      timeout: 30_000,
    });
    await expect.poll(() => fontLoaded(page)).toBe(true);

    expect(consoleErrors).toEqual([]);
  });

  for (const target of [
    { ...seed.yellowCress, charts: seed.yellowCress.chartPanels, maps: seed.yellowCress.sitesPanels },
    { ...seed.ozone, charts: seed.ozone.chartPanels, maps: seed.ozone.sitesPanels },
    { ...seed.socioEconomic, charts: 0, maps: 0 },
  ]) {
    test(`the ${TEMPLATE_LABELS[target.template]} layout of program ${target.id} logs no errors`, async ({
      page,
      consoleErrors,
    }) => {
      test.setTimeout(PANEL_TIMEOUT_MS * 2);
      await openProgram(page, target.id, target.name);
      await expectPanelsSettled(page, target.charts, target.maps);
      await expect(footer(page)).toContainText(CONNECTED_LINE);
      await expect.poll(() => fontLoaded(page)).toBe(true);

      expect(consoleErrors).toEqual([]);
    });
  }
});
