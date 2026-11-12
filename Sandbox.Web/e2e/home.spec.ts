// Browser tests for the home page: one scrolling page with the hero and its four
// totals, the threshold category cards beside the site map, All Programs, and
// About Monitoring, plus the sticky nav row that scrolls to those sections.
//
// The map draws 1,750 points on one canvas, so the tests read what it shows from
// its host element: data-state (loading, ready, error), data-points (sites drawn),
// and data-highlighted (sites in the data color; the rest are gray). The canvas
// itself is sampled to check that the two colors are the data color and gray. The
// map tiles come from Esri's servers; the points and their colors do not depend on them.
//
// The page follows Ecology's default look: neutral containers, no category colors,
// and one data color for every site.
import type { APIRequestContext, Locator, Page } from '@playwright/test';

import { API_URL, DATA_COLOR_TOKEN, FONT_PATTERN, HOME_SECTIONS, PANEL_TIMEOUT_MS, expect, seed, test } from './support';

interface Category {
  CategoryName: string;
  Folder: string;
  CategoryDescription: string;
  ProgramCount: number;
}

interface Program {
  MonitoringProgramID: number;
  MonitoringProgramName: string;
  CategoryName: string;
  SiteCount: number;
  PartnerNames: string[];
}

const MAP_TIMEOUT_MS = 30_000;

const homeMap = (page: Page): Locator => page.locator('app-home-map');
const mapTitle = (page: Page): Locator => page.locator('#map-title');
const cards = (page: Page): Locator => page.locator('app-category-card');
const card = (page: Page, folder: string): Locator => page.locator(`.cat[data-folder="${folder}"]`);
const cardHead = (page: Page, folder: string): Locator => card(page, folder).locator('.cat__head');
/**
 * Blank space the pointer can rest on: the Threshold Categories heading, just above the cards.
 * It is in view whenever the cards are, so reaching it never scrolls the page under the
 * pointer (a scroll would slide a card under the pointer and hover it). The map footer was
 * used before; with Featured Programs under the cards it can sit below the fold.
 */
const blank = (page: Page): Locator => page.locator('#categories-title');
/** Program links a reader can see: a closed card's list is hidden. */
const programLinks = (scope: Page | Locator): Locator => scope.locator('a.prog:visible');
// type="search", so the role is searchbox.
const searchBox = (page: Page): Locator =>
  page.getByRole('searchbox', { name: 'Find a program or partner' });
const navLink = (page: Page, label: string): Locator =>
  page.locator('.app-nav').getByRole('link', { name: label, exact: true });
const sectionHeading = (page: Page, name: string): Locator =>
  page.getByRole('heading', { level: 2, name, exact: true });
const listRows = (page: Page): Locator => page.locator('table.programs-table tbody tr');

async function categories(request: APIRequestContext): Promise<Category[]> {
  return (await (await request.get(`${API_URL}/categories`)).json()) as Category[];
}

async function programs(request: APIRequestContext): Promise<Program[]> {
  return (await (await request.get(`${API_URL}/monitoring-programs`)).json()) as Program[];
}

/** Opens a home address and waits for the cards and a drawn map. */
async function openHome(page: Page, path = '/'): Promise<void> {
  await page.goto(path);
  await expect(cards(page)).toHaveCount(seed.categories);
  await expect(homeMap(page)).toHaveAttribute('data-state', 'ready', { timeout: MAP_TIMEOUT_MS });
}

/** This many sites in the data color, and every other site drawn gray. */
async function expectHighlighted(page: Page, count: number): Promise<void> {
  await expect(homeMap(page)).toHaveAttribute('data-points', String(seed.sites.total));
  await expect(homeMap(page)).toHaveAttribute('data-highlighted', String(count));
}

/**
 * Pixels of the site canvas in the data color and in gray. Each token is first drawn
 * into a one-pixel canvas, so it compares as the same sRGB the map canvas holds.
 */
async function mapPixels(page: Page): Promise<{ data: number; gray: number }> {
  return homeMap(page).evaluate((host, dataToken) => {
    const rgb = (token: string): number[] => {
      const probe = document.createElement('span');
      probe.style.color = `var(${token})`;
      host.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      const swatch = document.createElement('canvas').getContext('2d')!;
      swatch.fillStyle = color;
      swatch.fillRect(0, 0, 1, 1);
      return [...swatch.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
    const data = rgb(dataToken);
    const gray = rgb('--color-gray-8');
    const near = (pixels: Uint8ClampedArray, i: number, target: number[]): boolean =>
      Math.abs(pixels[i] - target[0]) + Math.abs(pixels[i + 1] - target[1]) + Math.abs(pixels[i + 2] - target[2]) <= 24;
    const canvas = host.querySelector<HTMLCanvasElement>('.leaflet-overlay-pane canvas')!;
    const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
    let inData = 0;
    let inGray = 0;
    for (let i = 0; i < pixels.length; i += 4) {
      if (pixels[i + 3] === 0) continue;
      if (near(pixels, i, data)) inData += 1;
      else if (near(pixels, i, gray)) inGray += 1;
    }
    return { data: inData, gray: inGray };
  }, DATA_COLOR_TOKEN);
}

/** The nav item marked current; there is at most one. */
async function expectActiveNav(page: Page, label: string | null): Promise<void> {
  const current = page.locator('.app-nav a[aria-current="true"]');
  if (label === null) {
    await expect(current).toHaveCount(0);
    return;
  }
  await expect(current).toHaveCount(1);
  await expect(current).toHaveText(label);
}

/** True when the element's top sits below the sticky nav and in the upper half of the window. */
async function headingInView(page: Page, heading: Locator): Promise<boolean> {
  const navBottom = (await page.locator('.app-nav').boundingBox())!;
  const box = await heading.boundingBox();
  const height = page.viewportSize()!.height;
  return !!box && box.y >= navBottom.y + navBottom.height - 1 && box.y < height / 2;
}

async function sidewaysOverflow(page: Page): Promise<number> {
  return page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
}

test.describe('Home page', () => {
  test('the hero shows the four totals from the API', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Monitoring Programs' })).toBeVisible();
    const stats = page.locator('.hero-stat');
    await expect(stats.locator('dt')).toHaveText([
      'monitoring programs',
      'threshold categories',
      'mapped monitoring sites',
      'partner organizations',
    ]);
    await expect(stats.locator('dd')).toHaveText([
      String(seed.summary.programs),
      String(seed.summary.categories),
      '1,750',
      String(seed.summary.partners),
    ]);
  });

  test('ten category cards, alphabetical, with their program and site counts', async ({
    page,
    request,
  }) => {
    const names = (await categories(request)).map((category) => category.CategoryName).sort((a, b) => a.localeCompare(b, 'en'));
    await openHome(page);

    await expect(cards(page).locator('.cat__name')).toHaveText(names);
    for (const expected of [seed.airQuality, seed.waterQuality]) {
      await expect(card(page, expected.folder).locator('.cat__meta')).toHaveText(
        `${expected.programs} programs, ${expected.sites} mapped sites`,
      );
    }
    const recreation = card(page, seed.recreation.folder);
    await expect(recreation.locator('.cat__meta')).toHaveText('0 programs');

    // Neutral cards: every card has the same border and background, whatever its category.
    const looks = await page
      .locator('.cat')
      .evaluateAll((items) =>
        items.map((item) => `${getComputedStyle(item).borderTopColor} ${getComputedStyle(item).backgroundColor}`),
      );
    expect(new Set(looks).size, looks.join(' | ')).toBe(1);

    // Two across, and the two collapsed cards of each row are one height, even where a long
    // name wraps.
    const heights = await page.locator('.cat__head').evaluateAll((heads) => heads.map((head) => (head as HTMLElement).offsetHeight));
    for (let row = 0; row < heights.length; row += 2) {
      expect(heights[row + 1], `head heights ${heights.join(', ')}`).toBe(heights[row]);
      const left = (await cards(page).nth(row).boundingBox())!;
      const right = (await cards(page).nth(row + 1).boundingBox())!;
      expect(right.y).toBe(left.y);
      expect(right.x).toBeGreaterThan(left.x);
    }

    // A category with no programs says so when opened.
    await cardHead(page, seed.recreation.folder).click();
    await expect(recreation.locator('.cat__none')).toHaveText('No programs yet.');
    await expect(programLinks(recreation)).toHaveCount(0);
  });

  test('opening a card lists its programs, and a program link opens its page', async ({
    page,
    request,
  }) => {
    const waterQuality = (await programs(request))
      .filter((program) => program.CategoryName === seed.waterQuality.name)
      .map((program) => program.MonitoringProgramName)
      .sort((a, b) => a.localeCompare(b, 'en'));
    await openHome(page);
    const wq = card(page, seed.waterQuality.folder);

    // Closed: no program is reachable.
    await expect(cardHead(page, seed.waterQuality.folder)).toHaveAttribute('aria-expanded', 'false');
    await expect(programLinks(wq)).toHaveCount(0);

    await cardHead(page, seed.waterQuality.folder).click();
    await expect(cardHead(page, seed.waterQuality.folder)).toHaveAttribute('aria-expanded', 'true');
    await expect(page).toHaveURL(new RegExp(`/category/${seed.waterQuality.folder}$`));
    await expect(programLinks(wq).locator('.prog__name')).toHaveText(waterQuality);
    // Each program says how many sites it maps, or quietly that it maps none.
    await expect(programLinks(wq).filter({ hasText: seed.periphyton.name }).locator('.prog__sites')).toHaveText(
      `${seed.periphyton.sites} sites`,
    );
    await expect(
      programLinks(wq).filter({ hasText: 'Harmful Algae Bloom (HAB) Monitoring' }).locator('.prog__sites'),
    ).toHaveText('No mapped sites');
    // Only one card is open.
    await expect(page.locator('.cat__head[aria-expanded="true"]')).toHaveCount(1);

    // Selecting it again closes it and returns the address to the home page.
    await cardHead(page, seed.waterQuality.folder).click();
    await expect(cardHead(page, seed.waterQuality.folder)).toHaveAttribute('aria-expanded', 'false');
    await expect(page).toHaveURL(/\/$/);

    // A program link is a route change, not a page load.
    await cardHead(page, seed.waterQuality.folder).click();
    await page.evaluate(() => {
      (window as unknown as { e2eMarker?: boolean }).e2eMarker = true;
    });
    await programLinks(wq).filter({ hasText: seed.periphyton.name }).click();
    await expect(page).toHaveURL(new RegExp(`/programs/${seed.periphyton.id}$`));
    await expect(page.getByRole('heading', { level: 1, name: seed.periphyton.name })).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { e2eMarker?: boolean }).e2eMarker)).toBe(true);
  });

  test('search finds programs by name and by partner name', async ({ page, request }) => {
    const all = await programs(request);
    await openHome(page);

    // By program name: one card stays, open, with just the match; the map shows its sites.
    await searchBox(page).fill('ozone');
    await expect(cards(page)).toHaveCount(1);
    await expect(programLinks(page)).toHaveText([new RegExp(`^${seed.ozone.name.replace(/[()]/g, '\\$&')}`)]);
    const ozone = all.find((program) => program.MonitoringProgramID === seed.ozone.id)!;
    await expectHighlighted(page, ozone.SiteCount);
    await expect(mapTitle(page)).toHaveText('Search results');

    // By partner name: every program that partner works on, in its category's card.
    const partner = 'Desert Research Institute';
    const matches = all.filter((program) => program.PartnerNames.includes(partner));
    expect(matches.length).toBeGreaterThan(1);
    await searchBox(page).fill(partner);
    await expect(programLinks(page)).toHaveCount(matches.length);
    await expect(cards(page)).toHaveCount(new Set(matches.map((program) => program.CategoryName)).size);
    await expectHighlighted(page, matches.reduce((sum, program) => sum + program.SiteCount, 0));

    // No match: an empty state that clears the search.
    await searchBox(page).fill('zzzz-no-match');
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'No programs or partners match' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(cards(page)).toHaveCount(seed.categories);
    await expect(searchBox(page)).toHaveValue('');
    await expectHighlighted(page, seed.sites.total);
  });

  test('/category/water-quality opens the home page with Water Quality selected', async ({ page }) => {
    await openHome(page, `/category/${seed.waterQuality.folder}`);

    await expect(cardHead(page, seed.waterQuality.folder)).toHaveAttribute('aria-expanded', 'true');
    await expect(page.locator('.cat__head[aria-expanded="true"]')).toHaveCount(1);
    await expect(programLinks(card(page, seed.waterQuality.folder))).toHaveCount(seed.waterQuality.programs);
    await expect(mapTitle(page)).toHaveText(seed.waterQuality.name);
    await expectHighlighted(page, seed.waterQuality.sites);
    // Scrolled so the card is on screen.
    await expect(card(page, seed.waterQuality.folder)).toBeInViewport();

    // An unknown category is the home page with nothing selected.
    await openHome(page, '/category/not-a-category');
    await expect(page.locator('.cat__head[aria-expanded="true"]')).toHaveCount(0);
    await expectHighlighted(page, seed.sites.total);
  });

  test('the site map draws all 1,750 sites in the data color, and the rest gray when one is picked', async ({
    page,
  }) => {
    await page.goto('/');
    // The map arrives after the cards.
    await expect(cards(page)).toHaveCount(seed.categories);
    await expect(homeMap(page)).toHaveAttribute('data-state', 'ready', { timeout: MAP_TIMEOUT_MS });

    await expect(homeMap(page)).toHaveAttribute('data-points', String(seed.sites.total));
    await expectHighlighted(page, seed.sites.total);
    await expect(mapTitle(page)).toHaveText('All monitoring sites');
    await expect(page.locator('.map-panel__foot')).toHaveText(
      'Sites from Lake Tahoe Info as of Oct. 29, 2026. Programs without fixed sites are not mapped.',
    );
    // Every site in the one data color: the canvas holds it, and next to no gray.
    await expect.poll(async () => (await mapPixels(page)).data).toBeGreaterThan(0);
    const all = await mapPixels(page);
    expect(all.gray, `pixels with every site on: ${JSON.stringify(all)}`).toBeLessThan(all.data / 100);

    // A category picked: its 30 sites keep the data color, the other 1,720 turn gray.
    await cardHead(page, seed.airQuality.folder).hover();
    await expectHighlighted(page, seed.airQuality.sites);
    await expect
      .poll(async () => {
        const picked = await mapPixels(page);
        return picked.data > 0 && picked.gray > picked.data;
      })
      .toBe(true);

    // A legend entry for each category with mapped sites: all but Recreation, Fire Dynamics, and
    // Forest Structure.
    // Quiet chips that all look alike: no category swatches.
    await expect(page.locator('.map-legend__item')).toHaveCount(7);
    const chips = await page
      .locator('.map-legend__item:not([aria-pressed="true"])')
      .evaluateAll((items) => items.map((item) => `${getComputedStyle(item).backgroundColor} ${getComputedStyle(item).borderTopColor}`));
    expect(new Set(chips).size, chips.join(' | ')).toBe(1);
    // Leaflet's controls take the theme face.
    await expect(homeMap(page).locator('.leaflet-control-zoom-in')).toHaveCSS('font-family', FONT_PATTERN);
  });

  test('hover and focus color one category or program, a selection holds, and a blank click restores every color', async ({
    page,
  }) => {
    await openHome(page);

    // Hover a category: just its sites are in color, and they stay after the pointer leaves.
    await cardHead(page, seed.airQuality.folder).hover();
    await expectHighlighted(page, seed.airQuality.sites);
    await expect(mapTitle(page)).toHaveText(seed.airQuality.name);
    await blank(page).hover();
    await expectHighlighted(page, seed.airQuality.sites);

    // Focus does what hover does.
    await cardHead(page, seed.waterQuality.folder).focus();
    await expectHighlighted(page, seed.waterQuality.sites);

    // Select Water Quality by keyboard: hovering another category no longer changes the map.
    await page.keyboard.press('Enter');
    await expect(cardHead(page, seed.waterQuality.folder)).toHaveAttribute('aria-expanded', 'true');
    await cardHead(page, seed.airQuality.folder).hover();
    await expectHighlighted(page, seed.waterQuality.sites);

    // Its own programs still show while hovered or focused, then back to the category.
    const periphyton = programLinks(card(page, seed.waterQuality.folder)).filter({ hasText: seed.periphyton.name });
    await periphyton.hover();
    await expectHighlighted(page, seed.periphyton.sites);
    await expect(mapTitle(page)).toHaveText(seed.periphyton.name);
    await blank(page).hover();
    await expectHighlighted(page, seed.waterQuality.sites);
    await periphyton.focus();
    await expectHighlighted(page, seed.periphyton.sites);

    // A click on blank space closes the category and restores every color.
    await page.locator('.hero__intro').click();
    await expect(page.locator('.cat__head[aria-expanded="true"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expectHighlighted(page, seed.sites.total);
    await expect(mapTitle(page)).toHaveText('All monitoring sites');
  });

  test('the map keeps its view when the highlight changes, and a legend entry selects its category', async ({
    page,
  }) => {
    await openHome(page);
    const view = (): Promise<string> =>
      homeMap(page).locator('.leaflet-map-pane').evaluate((pane) => (pane as HTMLElement).style.transform);
    const before = await view();

    await cardHead(page, seed.airQuality.folder).hover();
    await expectHighlighted(page, seed.airQuality.sites);
    await page.locator('.map-legend__item', { hasText: seed.waterQuality.name }).click();
    await expect(cardHead(page, seed.waterQuality.folder)).toHaveAttribute('aria-expanded', 'true');
    await expectHighlighted(page, seed.waterQuality.sites);
    expect(await view()).toBe(before);
  });

  test('"Show in the list" filters All Programs to the open category', async ({ page }) => {
    await openHome(page);
    await cardHead(page, seed.waterQuality.folder).click();

    // The visible label, then the category for screen readers (a space may separate them).
    await page
      .getByRole('button', { name: new RegExp(`^Show in the list ?: ${seed.waterQuality.name} programs$`) })
      .click();

    await expect(sectionHeading(page, 'All Programs')).toBeFocused();
    await expect(listRows(page)).toHaveCount(seed.waterQuality.programs);
    await expect(page.getByRole('combobox', { name: 'Category' })).toContainText(seed.waterQuality.name);
    await expect.poll(() => headingInView(page, sectionHeading(page, 'All Programs'))).toBe(true);
    await expectActiveNav(page, 'All Programs');
  });

  test('Featured Programs shows six photo links, one per category first, and All opens the featured list', async ({
    page,
    request,
  }) => {
    // The key photos are full-size files from LT Info: the HAB photo is 5 MB and has taken 24
    // seconds on its own.
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await openHome(page);
    const strip = page.locator('app-featured-programs');
    await expect(strip.getByRole('heading', { name: 'Featured Programs' })).toBeVisible();
    const cards = strip.locator('.featured__card');
    await expect(cards).toHaveCount(6);
    // Every card links to its program page and its key photo loads.
    for (let i = 0; i < 6; i++) {
      await expect(cards.nth(i)).toHaveAttribute('href', /\/programs\/\d+$/);
      const img = cards.nth(i).locator('img');
      await img.scrollIntoViewIfNeeded();
      await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: PANEL_TIMEOUT_MS }).toBe(true);
    }
    // One per category before any category repeats: the first cards are as many different
    // categories as the featured programs come from (four in the seed).
    const featuredCategories = new Set(
      (await programs(request)).filter((program) => program.IsFeatured).map((program) => program.CategoryName),
    ).size;
    const shown = (await cards.locator('.featured__category').allTextContents()).map((c) => c.trim());
    expect(new Set(shown.slice(0, featuredCategories)).size).toBe(featuredCategories);
    // The photo frames line up: every frame has the same height.
    const heights = await strip.locator('.featured__photo').evaluateAll((els) => els.map((e) => Math.round(e.getBoundingClientRect().height)));
    expect(new Set(heights).size).toBe(1);

    await strip.getByRole('button', { name: /^All \d+ ?featured programs in the list$/ }).click();
    await expect(sectionHeading(page, 'All Programs')).toBeFocused();
    await expect(listRows(page)).toHaveCount(seed.featured);
  });

  test('hovering a featured program shows its sites on the map', async ({ page }) => {
    await openHome(page);
    const map = page.locator('app-home-map');
    await expect(map).toHaveAttribute('data-state', 'ready', { timeout: 60_000 });
    const card = page.locator('app-featured-programs .featured__card').first();
    await card.hover();
    await expect.poll(async () => Number(await map.getAttribute('data-highlighted'))).toBeLessThan(1750);
  });
});

test.describe('Nav row and sections', () => {
  test('each nav item scrolls to its section, moves focus to its heading, and becomes current', async ({
    page,
  }) => {
    await openHome(page);
    await expectActiveNav(page, 'Monitoring Programs');

    for (const section of [...HOME_SECTIONS].reverse()) {
      await navLink(page, section.nav).click();
      await expect(page).toHaveURL(new RegExp(`/#${section.id}$`));
      const heading = sectionHeading(page, section.heading);
      await expect(heading).toBeFocused();
      await expect.poll(() => headingInView(page, heading)).toBe(true);
      await expectActiveNav(page, section.nav);
      // The nav row stays at the top of the window.
      expect((await page.locator('.app-nav').boundingBox())!.y).toBe(0);
    }

    // The same item again, after scrolling away, still scrolls back.
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await navLink(page, 'Monitoring Programs').click();
    await expect.poll(() => headingInView(page, sectionHeading(page, 'Threshold Categories'))).toBe(true);
  });

  test('the current nav item follows the section in view', async ({ page }) => {
    await openHome(page);
    const scrollToSection = (id: string): Promise<void> =>
      page.evaluate((target) => {
        const nav = document.querySelector<HTMLElement>('.app-nav')!.offsetHeight;
        const top = document.getElementById(target)!.getBoundingClientRect().top + window.scrollY;
        window.scrollTo(0, top - nav - 16);
      }, id);

    await scrollToSection('all-programs');
    await expectActiveNav(page, 'All Programs');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expectActiveNav(page, 'About Monitoring');
    await scrollToSection('categories');
    await expectActiveNav(page, 'Monitoring Programs');
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectActiveNav(page, 'Monitoring Programs');
  });

  test('on a program page no nav item is current, and a nav item opens the home page at its section', async ({
    page,
  }) => {
    await page.goto(`/programs/${seed.ozone.id}`);
    await expect(page.getByRole('heading', { level: 1, name: seed.ozone.name })).toBeVisible();
    await expectActiveNav(page, null);

    await navLink(page, 'About Monitoring').click();
    await expect(page).toHaveURL(/\/#about$/);
    await expect(sectionHeading(page, 'About Monitoring')).toBeFocused();
    await expect.poll(() => headingInView(page, sectionHeading(page, 'About Monitoring'))).toBe(true);
    await expectActiveNav(page, 'About Monitoring');
  });

  test('/programs and /about redirect to their sections of the home page', async ({ page }) => {
    await page.goto('/programs');
    await expect(page).toHaveURL(/\/#all-programs$/);
    await expect(listRows(page)).toHaveCount(seed.programs);
    await expect(sectionHeading(page, 'All Programs')).toBeFocused();
    await expect.poll(() => headingInView(page, sectionHeading(page, 'All Programs'))).toBe(true);
    await expectActiveNav(page, 'All Programs');

    await page.goto('/about');
    await expect(page).toHaveURL(/\/#about$/);
    await expect(page.locator('.goal')).toHaveCount(seed.categories);
    await expect(sectionHeading(page, 'About Monitoring')).toBeFocused();
    await expectActiveNav(page, 'About Monitoring');
  });

  test('an unknown address still redirects home', async ({ page }) => {
    await page.goto('/no/such/page');
    await expect(page).toHaveURL(/\/$/);
    await expect(cards(page)).toHaveCount(seed.categories);
  });
});

test.describe('About Monitoring', () => {
  test('lists the ten category goals, each linking to its category', async ({ page, request }) => {
    const expected = [...(await categories(request))].sort((a, b) => a.CategoryName.localeCompare(b.CategoryName, 'en'));
    await page.goto('/#about');
    const goals = page.locator('.goal');

    await expect(goals).toHaveCount(seed.categories);
    await expect(goals.locator('.goal__name')).toHaveText(expected.map((category) => category.CategoryName));
    // The goals are the API's CategoryDescription, with percent written out.
    await expect(goals.locator('.goal__description')).toHaveText(
      expected.map((category) => category.CategoryDescription.replace(/(\d)\s?%/g, '$1 percent')),
    );
    await expect(page.locator('#about')).not.toContainText('%');
    // The data sources, each a link.
    await expect(page.locator('#about').getByRole('link', { name: 'Lake Tahoe Info' })).toHaveAttribute(
      'href',
      'https://monitoring.laketahoeinfo.org/',
    );
    await expect(page.locator('#about').getByRole('link', { name: 'LTInfo_Monitoring map service' })).toBeVisible();
    // Plain rows: no icons, no color swatches, and every goal row drawn the same way.
    await expect(goals.locator('img')).toHaveCount(0);
    const rows = await goals.evaluateAll((items) =>
      items.map((item) => {
        const style = getComputedStyle(item);
        return `${style.backgroundColor} ${style.borderLeftWidth} ${style.borderBottomColor}`;
      }),
    );
    expect(new Set(rows).size, rows.join(' | ')).toBe(1);

    const goal = (folder: string): Locator => page.locator(`.goal[data-folder="${folder}"]`);
    await expect(goal(seed.recreation.folder).locator('.goal__link')).toHaveText('No programs yet');
    const link = goal(seed.waterQuality.folder).getByRole('link', { name: '11 programs' });
    await expect(link).toHaveAttribute('href', `/category/${seed.waterQuality.folder}`);

    // The link opens the category on the map, above.
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/category/${seed.waterQuality.folder}$`));
    await expect(cardHead(page, seed.waterQuality.folder)).toHaveAttribute('aria-expanded', 'true');
    await expect(card(page, seed.waterQuality.folder)).toBeInViewport();
  });
});

test.describe('Home page at 375 px wide', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('does not scroll sideways, and stacks cards, then the map, in one column', async ({ page }) => {
    await openHome(page);

    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    // The hero runs edge to edge.
    const hero = (await page.locator('.hero').boundingBox())!;
    expect(hero.x).toBe(0);
    expect(hero.width).toBe(375);
    // One card across, and the map under the last card.
    const boxes = await Promise.all((await cards(page).all()).map((item) => item.boundingBox()));
    expect(new Set(boxes.map((box) => Math.round(box!.x))).size).toBe(1);
    const map = (await page.locator('.map-panel').boundingBox())!;
    expect(map.y).toBeGreaterThan(boxes[boxes.length - 1]!.y);
    expect(map.x + map.width).toBeLessThanOrEqual(375);
    // The three nav items fit.
    for (const section of HOME_SECTIONS) {
      const box = (await navLink(page, section.nav).boundingBox())!;
      expect(box.x + box.width, section.nav).toBeLessThanOrEqual(375);
    }

    // Opening the longest card still fits.
    await cardHead(page, seed.waterQuality.folder).click();
    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
  });
});

test.describe('Home page console', () => {
  test('a clean load, a hover, and a selection log no errors', async ({ page, consoleErrors }) => {
    await openHome(page);
    await cardHead(page, seed.airQuality.folder).hover();
    await cardHead(page, seed.waterQuality.folder).click();
    await expectHighlighted(page, seed.waterQuality.sites);
    await page.evaluate(() => document.fonts.ready);

    expect(consoleErrors).toEqual([]);
  });
});
