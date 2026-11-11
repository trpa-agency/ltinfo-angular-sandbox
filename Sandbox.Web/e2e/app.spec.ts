// Browser tests for Sandbox.Web at BASE_URL. They run the same way against the
// dev server and against the production nginx build: every page is opened by
// its address, every wait is for something a user can see, and nothing reads
// dev-server internals.
//
// The search box, the category select, and the featured toggle are Ecology Lit
// elements with shadow roots. Playwright locators reach into open shadow roots,
// so they are found by role and name like any other control.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { API_URL, expect, seed, test } from './support';

const programUrl = (id: number): string => `/programs/${id}`;
const apiProgramUrl = (id: number): string => `${API_URL}/monitoring-programs/${id}`;

const rows = (page: Page): Locator => page.locator('table.programs-table tbody tr');
const resultCount = (page: Page): Locator => page.locator('.results__count');
const searchBox = (page: Page): Locator => page.getByRole('textbox', { name: 'Search programs' });
const categorySelect = (page: Page): Locator => page.getByRole('combobox', { name: 'Category' });
const featuredOnly = (page: Page): Locator => page.getByRole('radio', { name: 'Featured only' });
const allPrograms = (page: Page): Locator => page.getByRole('radio', { name: 'All programs' });
const statValue = (page: Page, label: string): Locator =>
  page.locator('.esa-stat').filter({ hasText: label }).locator('.esa-stat__value');
const footer = (page: Page): Locator => page.locator('.app-footer');
const savedValue = (page: Page): Locator => page.locator('.featured__value');
const featuredButton = (page: Page): Locator => page.locator('.featured').getByRole('button');

const CONNECTED_LINE = `Angular, the API, and SQL Server are connected. Database ${seed.database}, ${seed.programs} programs.`;

/** Opens the list and waits for the table and the footer health line. */
async function openList(page: Page): Promise<void> {
  await page.goto('/');
  await expect(rows(page)).toHaveCount(seed.programs);
  await expect(footer(page)).toContainText(CONNECTED_LINE);
}

/** Opens a program by its address and waits for its heading. */
async function openProgram(page: Page, id: number, name: string): Promise<void> {
  await page.goto(programUrl(id));
  await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
}

/** True once the Lexend Deca files have arrived, not only been asked for. */
async function lexendDecaLoaded(page: Page): Promise<boolean> {
  return page.evaluate(async () => {
    await document.fonts.ready;
    return [...document.fonts].some(
      (face) => face.family.replace(/["']/g, '') === 'Lexend Deca' && face.status === 'loaded',
    );
  });
}

/** How far the page can scroll sideways, in pixels. Zero or less means not at all. */
async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

async function featuredCount(request: APIRequestContext): Promise<number> {
  const programs = (await (await request.get(`${API_URL}/monitoring-programs`)).json()) as {
    IsFeatured: boolean;
  }[];
  return programs.filter((program) => program.IsFeatured).length;
}

test.describe('Program list', () => {
  test.beforeEach(async ({ page }) => {
    await openList(page);
  });

  test('applies the LT Info theme, Lexend Deca, and the page background', async ({ page }) => {
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'ltinfo');
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(247, 247, 247)');
    await expect(page.locator('body')).toHaveCSS('font-family', /Lexend Deca/);

    // The face reaches text in the page, in a table cell, and inside a shadow root.
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('font-family', /Lexend Deca/);
    await expect(rows(page).first().locator('th')).toHaveCSS('font-family', /Lexend Deca/);
    await expect(searchBox(page)).toHaveCSS('font-family', /Lexend Deca/);
    await expect(categorySelect(page)).toHaveCSS('font-family', /Lexend Deca/);

    await expect.poll(() => lexendDecaLoaded(page)).toBe(true);
  });

  test('shows the four stat tiles with the seeded totals', async ({ page }) => {
    const tiles = page.locator('.esa-stat');

    await expect(tiles).toHaveCount(4);
    await expect(tiles.locator('.esa-stat__label')).toHaveText([
      'Programs',
      'Categories',
      'Featured',
      'Partner links',
    ]);
    await expect(tiles.locator('.esa-stat__value')).toHaveText([
      String(seed.programs),
      String(seed.categories),
      String(seed.featured),
      String(seed.partnerLinks),
    ]);
  });

  test('lists all 36 programs', async ({ page }) => {
    await expect(rows(page)).toHaveCount(seed.programs);
    await expect(resultCount(page)).toHaveText(`Showing ${seed.programs} of ${seed.programs}`);
    await expect(page.locator('table.programs-table thead th')).toHaveText([
      'Program',
      'Category',
      'Partners',
      'Featured',
    ]);
    await expect(page.getByRole('link', { name: seed.ozone.name, exact: true })).toHaveAttribute(
      'href',
      programUrl(seed.ozone.id),
    );
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
    await expect(rows(page).locator('td:nth-child(2)')).toHaveText(
      Array.from({ length: seed.airQualityPrograms }, () => seed.ozone.category),
    );
    await expect(categorySelect(page)).toContainText(seed.ozone.category);
  });

  test('featured only shows the 17 featured programs', async ({ page }) => {
    await featuredOnly(page).click();

    await expect(featuredOnly(page)).toHaveAttribute('aria-checked', 'true');
    await expect(rows(page)).toHaveCount(seed.featured);
    await expect(rows(page).locator('td:nth-child(4)')).toHaveText(
      Array.from({ length: seed.featured }, () => 'Featured'),
    );
    // The filtered table and the Featured tile count the same thing.
    await expect(statValue(page, 'Featured')).toHaveText(String(seed.featured));

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

test.describe('Program detail', () => {
  test('program 41 shows Ozone with its category, empty description, and 6 partners', async ({
    page,
  }) => {
    // Opened by address: on the nginx build this also proves the SPA fallback.
    await openProgram(page, seed.ozone.id, seed.ozone.name);

    await expect(page.locator('.program-head__badges')).toContainText(seed.ozone.category);
    await expect(page.locator('.esa-card__title')).toHaveText([
      'Featured',
      'Description',
      'Monitoring approach',
      'Partners',
    ]);
    await expect(savedValue(page)).toHaveText('Saved value: Not featured');
    await expect(featuredButton(page)).toHaveText('Mark as featured');
    await expect(page.getByRole('heading', { name: 'No description yet' })).toBeVisible();
    await expect(page.locator('.prose')).toContainText('Ozone is monitored');

    await expect(page.locator('.partners li')).toHaveCount(seed.ozone.partners);
    await expect(page.locator('.partners li').first()).toHaveText(
      'Tahoe Regional Planning Agency (TRPA)',
    );
    await expect(page.getByText(`Partner links in the database: ${seed.ozone.partners}`)).toBeVisible();
    await expect(page.getByRole('link', { name: 'All programs' })).toHaveAttribute('href', '/');
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
    const patchResponse = () =>
      page.waitForResponse(
        (response) =>
          response.request().method() === 'PATCH' &&
          new URL(response.url()).pathname === `/api/monitoring-programs/${id}`,
      );

    try {
      await openProgram(page, id, name);
      await expect(savedValue(page)).toHaveText(`Saved value: ${label(original.IsFeatured)}`);
      await expect(featuredButton(page)).toHaveText(action(original.IsFeatured));

      // First click: the page sends PATCH and shows what the API sent back.
      let patched = patchResponse();
      await featuredButton(page).click();
      const firstPatch = await patched;
      expect(firstPatch.status()).toBe(200);
      expect(firstPatch.request().postDataJSON()).toEqual({ IsFeatured: !original.IsFeatured });
      await expect(savedValue(page)).toHaveText(`Saved value: ${label(!original.IsFeatured)}`);
      await expect(featuredButton(page)).toHaveText(action(!original.IsFeatured));
      await expect(featuredButton(page)).toBeEnabled();

      // The value is in SQL Server, not only on the page: the API agrees, and a
      // fresh load of the list counts one more (or one fewer) featured program.
      const saved = (await (await request.get(apiProgramUrl(id))).json()) as {
        IsFeatured: boolean;
      };
      expect(saved.IsFeatured).toBe(!original.IsFeatured);
      const featuredAfter = featuredBefore + (original.IsFeatured ? -1 : 1);
      await page.goto('/');
      await expect(rows(page)).toHaveCount(seed.programs);
      await expect(statValue(page, 'Featured')).toHaveText(String(featuredAfter));

      // Second click, on a fresh load of the detail page: back to the original.
      await openProgram(page, id, name);
      await expect(savedValue(page)).toHaveText(`Saved value: ${label(!original.IsFeatured)}`);
      patched = patchResponse();
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
      // The rest of the app is fine: the shell and the health line still show.
      await expect(footer(page)).toContainText(CONNECTED_LINE);

      expect(consoleErrors).toHaveLength(1);
      expect(consoleErrors[0]).toMatch(expected404);

      await page.getByRole('link', { name: 'All programs' }).click();
      await expect(rows(page)).toHaveCount(seed.programs);
    });
  });
});

test.describe('API down', () => {
  // Every aborted request is logged by the browser as a failed resource.
  test.use({ allowedConsoleErrors: [/net::ERR_CONNECTION_REFUSED/] });

  test('the list shows the error state, and Try again recovers', async ({ page }) => {
    const isApiCall = (url: URL): boolean => url.pathname.startsWith('/api/');
    await page.route(isApiCall, (route) => route.abort('connectionrefused'));

    await page.goto('/');

    await expect(page.getByRole('heading', { name: 'The API did not respond' })).toBeVisible();
    await expect(
      page.getByText('Start the sandbox.api container, then try again.'),
    ).toBeVisible();
    await expect(page.locator('table.programs-table')).toHaveCount(0);
    // An error state, not a blank page: the header and the footer still render.
    await expect(page.locator('.app-bar')).toContainText('Lake Tahoe Info');
    await expect(footer(page)).toContainText('Not connected');

    await page.unroute(isApiCall);
    await page.getByRole('button', { name: 'Try again' }).click();

    await expect(rows(page)).toHaveCount(seed.programs);
    await expect(statValue(page, 'Programs')).toHaveText(String(seed.programs));
  });
});

test.describe('At 375 px wide', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('the list does not scroll sideways', async ({ page }) => {
    await openList(page);

    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);

    // The wide table scrolls inside its own region instead of widening the page.
    const tableRegion = page.locator('.table-scroll');
    const regionBox = await tableRegion.boundingBox();
    expect(regionBox).not.toBeNull();
    expect(regionBox!.x + regionBox!.width).toBeLessThanOrEqual(375);
  });

  test('the detail page does not scroll sideways', async ({ page }) => {
    await openProgram(page, seed.ozone.id, seed.ozone.name);
    await expect(page.locator('.partners li')).toHaveCount(seed.ozone.partners);

    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('Console on a clean load', () => {
  test('the list route logs no errors', async ({ page, consoleErrors }) => {
    await openList(page);
    await expect.poll(() => lexendDecaLoaded(page)).toBe(true);

    expect(consoleErrors).toEqual([]);
  });

  test('the detail route logs no errors', async ({ page, consoleErrors }) => {
    await openProgram(page, seed.ozone.id, seed.ozone.name);
    await expect(page.locator('.partners li')).toHaveCount(seed.ozone.partners);
    await expect(footer(page)).toContainText(CONNECTED_LINE);
    await expect.poll(() => lexendDecaLoaded(page)).toBe(true);

    expect(consoleErrors).toEqual([]);
  });
});
