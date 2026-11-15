// Browser tests for the home page: one scrolling page with the hero (the search and the
// three totals), the headline measures, the category cards grouped by topic, the site map
// with its topic legend, All Programs, and About Monitoring, plus the sticky nav row that
// scrolls to those sections. The topic grouping is checked first, in Node.
//
// The map draws 1,842 points on one canvas, so the tests read what it shows from
// its host element: data-state (loading, ready, error), data-points (sites drawn),
// and data-highlighted (sites in color; the rest are gray). The canvas itself is sampled
// to check that the colors are the topic colors and gray. The map tiles come from Esri's
// servers; the points and their colors do not depend on them.
//
// Containers stay neutral: the cards carry no category colors. Color marks the topics: a
// dot on each topic heading and legend row, and the topic's sites on the map.
import type { APIRequestContext, Locator, Page } from '@playwright/test';
import { expect as nodeExpect, test as nodeTest } from '@playwright/test';

import { HOME_HEADLINE_PROGRAMS, OTHER_TOPIC, TOPICS, groupByTopic, topicOf } from '../src/app/lib/home-page';
import { API_URL, FONT_PATTERN, HOME_SECTIONS, LIST_CAP, PANEL_TIMEOUT_MS, expect, seed, test } from './support';

interface Category {
  CategoryName: string;
  Folder: string;
  Blurb: string;
  CategoryDescription: string;
  ProgramCount: number;
  SiteCount: number;
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
const headlines = (page: Page): Locator => page.locator('app-home-headlines');
const legendItem = (page: Page, topicId: string): Locator => page.locator(`.map-legend__item[data-topic="${topicId}"]`);

const FIRST = HOME_SECTIONS[0];
const LAST = HOME_SECTIONS[HOME_SECTIONS.length - 1];

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

/** This many sites in color, and every other site drawn gray. */
async function expectHighlighted(page: Page, count: number): Promise<void> {
  await expect(homeMap(page)).toHaveAttribute('data-points', String(seed.sites.total));
  await expect(homeMap(page)).toHaveAttribute('data-highlighted', String(count));
}

/**
 * Pixels of the site canvas in a topic color and in gray. Each token is first drawn into a
 * one-pixel canvas, so it compares as the same sRGB the map canvas holds.
 */
async function mapPixels(page: Page): Promise<{ data: number; gray: number }> {
  return homeMap(page).evaluate(
    (host, colors) => {
      const rgb = (value: string): number[] => {
        const probe = document.createElement('span');
        probe.style.color = value;
        host.append(probe);
        const color = getComputedStyle(probe).color;
        probe.remove();
        const swatch = document.createElement('canvas').getContext('2d')!;
        swatch.fillStyle = color;
        swatch.fillRect(0, 0, 1, 1);
        return [...swatch.getImageData(0, 0, 1, 1).data.slice(0, 3)];
      };
      const data = colors.map(rgb);
      const gray = rgb('var(--color-gray-8)');
      const near = (pixels: Uint8ClampedArray, i: number, target: number[]): boolean =>
        Math.abs(pixels[i] - target[0]) + Math.abs(pixels[i + 1] - target[1]) + Math.abs(pixels[i + 2] - target[2]) <= 24;
      const canvas = host.querySelector<HTMLCanvasElement>('.leaflet-overlay-pane canvas')!;
      const pixels = canvas.getContext('2d')!.getImageData(0, 0, canvas.width, canvas.height).data;
      let inData = 0;
      let inGray = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        if (pixels[i + 3] === 0) continue;
        if (data.some((target) => near(pixels, i, target))) inData += 1;
        else if (near(pixels, i, gray)) inGray += 1;
      }
      return { data: inData, gray: inGray };
    },
    TOPICS.map((topic) => topic.color),
  );
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

/** Each topic with mapped sites, and how many, from the API's categories. */
function topicSites(all: readonly Category[]): { id: string; name: string; sites: number }[] {
  return groupByTopic(all, (category) => category.Folder)
    .map(({ topic, items }) => ({
      id: topic.id,
      name: topic.name,
      sites: items.reduce((sum, category) => sum + category.SiteCount, 0),
    }))
    .filter((entry) => entry.sites > 0);
}

nodeTest.describe('Home page topics', () => {
  nodeTest('every topic has a name, a color of its own, and folders no other topic lists', () => {
    nodeExpect(new Set(TOPICS.map((topic) => topic.id)).size).toBe(TOPICS.length);
    nodeExpect(new Set(TOPICS.map((topic) => topic.name)).size).toBe(TOPICS.length);
    nodeExpect(new Set([...TOPICS, OTHER_TOPIC].map((topic) => topic.color)).size).toBe(TOPICS.length + 1);
    for (const topic of TOPICS) nodeExpect(topic.color).toMatch(/^var\(--color-background-dataviz-categorical-\d\)$/);
    const folders = TOPICS.flatMap((topic) => topic.folders);
    nodeExpect(new Set(folders).size).toBe(folders.length);
    // The writing rules: "and", never an ampersand.
    for (const topic of TOPICS) nodeExpect(topic.name).not.toMatch(/&/);
  });

  nodeTest('a folder belongs to its topic, and an unlisted folder to Other Topics', () => {
    nodeExpect(topicOf('water-quality').id).toBe('lake-and-water');
    nodeExpect(topicOf('forest-structure').id).toBe('land-and-forest');
    nodeExpect(topicOf('noise').id).toBe('air-climate-and-noise');
    nodeExpect(topicOf('demographics').id).toBe('people-and-communities');
    nodeExpect(topicOf('scenic-resources').id).toBe('recreation-and-scenery');
    nodeExpect(topicOf('a-new-category')).toBe(OTHER_TOPIC);
  });

  nodeTest('groups items by topic in page order, in folder order, and drops empty topics', () => {
    const folder = (item: string): string => item;
    const grouped = groupByTopic(['noise', 'aquatic-invasive-species', 'water-quality', 'brand-new', 'air-quality'], folder);
    nodeExpect(grouped.map((group) => group.topic.id)).toEqual(['lake-and-water', 'air-climate-and-noise', 'other']);
    nodeExpect(grouped[0].items).toEqual(['water-quality', 'aquatic-invasive-species']);
    nodeExpect(grouped[1].items).toEqual(['air-quality', 'noise']);
    nodeExpect(grouped[2].items).toEqual(['brand-new']);
    nodeExpect(groupByTopic([], folder)).toEqual([]);
  });

  nodeTest('the headline programs are listed once each', () => {
    nodeExpect(HOME_HEADLINE_PROGRAMS.length).toBeGreaterThan(0);
    nodeExpect(new Set(HOME_HEADLINE_PROGRAMS).size).toBe(HOME_HEADLINE_PROGRAMS.length);
  });
});

test.describe('Home page', () => {
  test('the hero shows the search and the three totals from the API', async ({ page }) => {
    await page.goto('/');

    await expect(page.getByRole('heading', { level: 1, name: 'Monitoring Programs' })).toBeVisible();
    await expect(page.locator('.hero').getByRole('searchbox', { name: 'Find a program or partner' })).toBeVisible();
    const stats = page.locator('.hero-stat');
    await expect(stats.locator('dt')).toHaveText([
      'monitoring programs',
      'mapped monitoring sites',
      'partner organizations',
    ]);
    await expect(stats.locator('dd')).toHaveText([
      String(seed.summary.programs),
      seed.summary.mappedSites.toLocaleString('en-US'),
      String(seed.summary.partners),
    ]);
  });

  test('Headline Measures shows the latest value of each listed program, the same figure as its page', async ({
    page,
  }) => {
    // The figures are read live from TRPA's map services, like the charts on a program page.
    test.setTimeout(PANEL_TIMEOUT_MS * 3);
    await page.goto('/');
    await expect(sectionHeading(page, 'Headline Measures')).toBeVisible();
    await expect(headlines(page)).toHaveAttribute('data-state', 'ready', { timeout: PANEL_TIMEOUT_MS });

    // A tile for each listed program whose data loaded, in the listed order, each a link to its program.
    const tiles = headlines(page).locator('.headline');
    const ids = (await tiles.evaluateAll((items) => items.map((item) => Number(item.getAttribute('data-program-id')))));
    expect(ids.length).toBeGreaterThan(0);
    expect(ids).toEqual(HOME_HEADLINE_PROGRAMS.filter((id) => ids.includes(id)));
    for (let i = 0; i < ids.length; i += 1) {
      await expect(tiles.nth(i).locator('.esa-stat__value')).not.toBeEmpty();
      await expect(tiles.nth(i).locator('svg.trend polyline')).toHaveCount(1);
      await expect(tiles.nth(i).getByRole('link')).toHaveAttribute('href', new RegExp(`/programs/${ids[i]}$`));
    }
    // The tiles are neutral boxes, drawn alike.
    const looks = await tiles.evaluateAll((items) =>
      items.map((item) => `${getComputedStyle(item).borderTopColor} ${getComputedStyle(item).backgroundColor}`),
    );
    expect(new Set(looks).size, looks.join(' | ')).toBe(1);

    // The first tile's figure is the one its program page leads with.
    const value = (await tiles.first().locator('.esa-stat__value').innerText()).trim();
    const name = (await tiles.first().getByRole('link').innerText()).trim();
    await tiles.first().getByRole('link').click();
    await expect(page).toHaveURL(new RegExp(`/programs/${ids[0]}$`));
    await expect(page.getByRole('heading', { level: 1, name })).toBeVisible();
    await expect(page.locator('[data-tile="headline"] .esa-stat__value')).toHaveText(value, { timeout: PANEL_TIMEOUT_MS });
  });

  test('the category cards under their topics, with their blurbs and their program and site counts', async ({
    page,
    request,
  }) => {
    const all = await categories(request);
    const grouped = groupByTopic(all, (category) => category.Folder);
    await openHome(page);

    // Every topic in page order, each with its dot, and its cards in the topic's own order.
    await expect(page.locator('.topic__name')).toHaveText(grouped.map((group) => group.topic.name));
    expect(grouped.map((group) => group.topic.id)).toEqual(TOPICS.map((topic) => topic.id));
    await expect(page.locator('.topic__name .topic-dot')).toHaveCount(grouped.length);
    await expect(cards(page).locator('.cat__name')).toHaveText(
      grouped.flatMap((group) => group.items.map((category) => category.CategoryName)),
    );
    await expect(cards(page).locator('.cat__blurb')).toHaveText(
      grouped.flatMap((group) => group.items.map((category) => category.Blurb)),
    );
    // The dots are the topic colors, each different.
    const dots = await page
      .locator('.topic__name .topic-dot')
      .evaluateAll((items) => items.map((item) => getComputedStyle(item).backgroundColor));
    expect(new Set(dots).size, dots.join(' | ')).toBe(grouped.length);

    // Every card has its icon, and every icon has loaded, the web app's own included.
    const icons = cards(page).locator('.cat__icon img');
    await expect(icons).toHaveCount(all.length);
    await expect
      .poll(() => icons.evaluateAll((imgs) => imgs.every((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)))
      .toBe(true);
    for (const expected of [seed.airQuality, seed.waterQuality]) {
      await expect(card(page, expected.folder).locator('.cat__meta')).toHaveText(
        `${expected.programs} programs, ${expected.sites} mapped sites`,
      );
    }
    const recreation = card(page, seed.recreation.folder);
    await expect(recreation.locator('.cat__meta')).toHaveText('1 program');

    // Neutral cards: every card has the same border and background, whatever its topic.
    const looks = await page
      .locator('.cat')
      .evaluateAll((items) =>
        items.map((item) => `${getComputedStyle(item).borderTopColor} ${getComputedStyle(item).backgroundColor}`),
      );
    expect(new Set(looks).size, looks.join(' | ')).toBe(1);

    // Cards of one topic sit side by side, the same height: the first topic's two share a row.
    const first = page.locator('.topic').first().locator('app-category-card');
    const [a, b] = await Promise.all([first.nth(0).boundingBox(), first.nth(1).boundingBox()]);
    expect(b!.y).toBe(a!.y);
    expect(b!.x).toBeGreaterThan(a!.x + a!.width - 1);
    expect(Math.round(b!.height)).toBe(Math.round(a!.height));

    // A category with one program and no sites on the home map lists it when opened, and
    // says nothing about sites: the program's own page may map areas or a service layer.
    await cardHead(page, seed.recreation.folder).click();
    await expect(programLinks(recreation)).toHaveCount(1);
    await expect(programLinks(recreation)).toContainText(seed.recreation.program);
    await expect(recreation.locator('.prog__sites')).toHaveCount(0);
    await expect(page.getByText('No mapped sites')).toHaveCount(0);
  });

  test('opening a card lists its programs across the row, and a program link opens its page', async ({
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
    // Each program says how many sites it has on the home map, and nothing when it has none.
    await expect(programLinks(wq).filter({ hasText: seed.periphyton.name }).locator('.prog__sites')).toHaveText(
      `${seed.periphyton.sites} sites`,
    );
    await expect(
      programLinks(wq).filter({ hasText: 'Harmful Algae Bloom (HAB) Monitoring' }).locator('.prog__sites'),
    ).toHaveCount(0);
    // Only one card is open, and it takes the whole row of its topic.
    await expect(page.locator('.cat__head[aria-expanded="true"]')).toHaveCount(1);
    const row = (await page.locator('.topic').first().locator('.cat-grid').boundingBox())!;
    await expect.poll(async () => Math.round((await wq.boundingBox())!.width)).toBe(Math.round(row.width));

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
    await expect(headlines(page)).toHaveCount(1);

    // By program name: one card stays, open, under its topic, with just the match; the map
    // shows its sites. The headline measures step aside, so the results sit under the hero.
    await searchBox(page).fill('ozone');
    await expect(cards(page)).toHaveCount(1);
    await expect(page.locator('.topic')).toHaveCount(1);
    await expect(page.locator('.topic__name')).toHaveText(['Air, Climate, and Noise']);
    await expect(headlines(page)).toHaveCount(0);
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

    // No match: an empty state that clears the search, and every site is in color again.
    await searchBox(page).fill('zzzz-no-match');
    await expect(cards(page)).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'No programs or partners match' })).toBeVisible();
    await page.getByRole('button', { name: 'Clear search' }).click();
    await expect(cards(page)).toHaveCount(seed.categories);
    await expect(searchBox(page)).toHaveValue('');
    await expect(headlines(page)).toHaveCount(1);
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

    // "Show all sites" beside the map closes the category.
    await page.getByRole('button', { name: 'Show all sites' }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('.cat__head[aria-expanded="true"]')).toHaveCount(0);
    await expectHighlighted(page, seed.sites.total);
    await expect(page.getByRole('button', { name: 'Show all sites' })).toHaveCount(0);

    // An unknown category is the home page with nothing selected.
    await openHome(page, '/category/not-a-category');
    await expect(page.locator('.cat__head[aria-expanded="true"]')).toHaveCount(0);
    await expectHighlighted(page, seed.sites.total);
  });

  test('the site map draws all 1,842 sites in their topic colors, and the rest gray when a category is open', async ({
    page,
  }) => {
    await page.goto('/');
    // The map arrives after the cards.
    await expect(cards(page)).toHaveCount(seed.categories);
    await expect(homeMap(page)).toHaveAttribute('data-state', 'ready', { timeout: MAP_TIMEOUT_MS });

    await expect(sectionHeading(page, 'Monitoring Sites')).toBeVisible();
    await expect(homeMap(page)).toHaveAttribute('data-points', String(seed.sites.total));
    await expectHighlighted(page, seed.sites.total);
    await expect(mapTitle(page)).toHaveText('All monitoring sites');
    await expect(page.locator('.map-panel__sub')).toHaveText(`${seed.sites.total.toLocaleString('en-US')} mapped sites`);
    await expect(page.locator('.map-panel__foot')).toHaveText(
      'Sites from Lake Tahoe Info as of Oct. 29, 2026. Programs without fixed sites are not mapped.',
    );
    // Every site in a topic color: the canvas holds them, and next to no gray.
    await homeMap(page).scrollIntoViewIfNeeded();
    await expect.poll(async () => (await mapPixels(page)).data).toBeGreaterThan(0);
    const all = await mapPixels(page);
    expect(all.gray, `pixels with every site on: ${JSON.stringify(all)}`).toBeLessThan(all.data / 100);

    // A category opened: its 30 sites keep their color, the other 1,812 turn gray.
    await cardHead(page, seed.airQuality.folder).click();
    await expectHighlighted(page, seed.airQuality.sites);
    await expect(mapTitle(page)).toHaveText(seed.airQuality.name);
    await homeMap(page).scrollIntoViewIfNeeded();
    await expect
      .poll(async () => {
        const picked = await mapPixels(page);
        return picked.data > 0 && picked.gray > picked.data;
      })
      .toBe(true);
    // Leaflet's controls take the theme face.
    await expect(homeMap(page).locator('.leaflet-control-zoom-in')).toHaveCSS('font-family', FONT_PATTERN);
  });

  test('the topic legend counts each topic, and unchecking a topic grays its sites', async ({ page, request }) => {
    const topics = topicSites(await categories(request));
    await openHome(page);

    // A row for each topic with mapped sites: a checked box, the topic's dot, and its count.
    const rows = page.locator('.map-legend__item');
    await expect(rows.locator('.map-legend__name')).toHaveText(topics.map((topic) => topic.name));
    await expect(rows.locator('.map-legend__count')).toHaveText(topics.map((topic) => topic.sites.toLocaleString('en-US')));
    expect(topics.reduce((sum, topic) => sum + topic.sites, 0)).toBe(seed.sites.total);
    for (const topic of topics) await expect(legendItem(page, topic.id).getByRole('checkbox')).toBeChecked();
    // A legend dot is the same color as its topic's heading dot.
    const legendDots = await rows.locator('.topic-dot').evaluateAll((items) => items.map((item) => getComputedStyle(item).backgroundColor));
    const headingDots = await page
      .locator('.topic__name .topic-dot')
      .evaluateAll((items) => items.map((item) => getComputedStyle(item).backgroundColor));
    expect(legendDots).toEqual(headingDots.slice(0, legendDots.length));

    // Uncheck one topic: its sites turn gray, and the panel says how many are left in color.
    const [off, other] = topics;
    await legendItem(page, off.id).getByRole('checkbox').uncheck();
    await expectHighlighted(page, seed.sites.total - off.sites);
    await expect(mapTitle(page)).toHaveText('Selected topics');
    await expect(page.locator('.map-panel__sub')).toHaveText(
      `${(seed.sites.total - off.sites).toLocaleString('en-US')} of ${seed.sites.total.toLocaleString('en-US')} mapped sites`,
    );
    await legendItem(page, other.id).getByRole('checkbox').uncheck();
    await expectHighlighted(page, seed.sites.total - off.sites - other.sites);

    // An open category holds the map, so the legend is disabled until it closes.
    await cardHead(page, seed.waterQuality.folder).click();
    await expectHighlighted(page, seed.waterQuality.sites);
    await expect(legendItem(page, off.id).getByRole('checkbox')).toBeDisabled();
    await cardHead(page, seed.waterQuality.folder).click();
    await expect(legendItem(page, off.id).getByRole('checkbox')).toBeEnabled();
    await expectHighlighted(page, seed.sites.total - off.sites - other.sites);

    // Checked again: every site is back in color.
    await legendItem(page, off.id).getByRole('checkbox').check();
    await legendItem(page, other.id).getByRole('checkbox').check();
    await expectHighlighted(page, seed.sites.total);
    await expect(mapTitle(page)).toHaveText('All monitoring sites');
  });

  test('a click on blank space closes the open category and restores every color', async ({ page }) => {
    await openHome(page);

    // Open by keyboard.
    await cardHead(page, seed.waterQuality.folder).focus();
    await page.keyboard.press('Enter');
    await expect(cardHead(page, seed.waterQuality.folder)).toHaveAttribute('aria-expanded', 'true');
    await expectHighlighted(page, seed.waterQuality.sites);

    await page.locator('.hero__intro').click();
    await expect(page.locator('.cat__head[aria-expanded="true"]')).toHaveCount(0);
    await expect(page).toHaveURL(/\/$/);
    await expectHighlighted(page, seed.sites.total);
    await expect(mapTitle(page)).toHaveText('All monitoring sites');
  });

  test('the map keeps its view when the highlight changes', async ({ page, request }) => {
    const [topic] = topicSites(await categories(request));
    await openHome(page);
    const view = (): Promise<string> =>
      homeMap(page).locator('.leaflet-map-pane').evaluate((pane) => (pane as HTMLElement).style.transform);
    const before = await view();

    await legendItem(page, topic.id).getByRole('checkbox').uncheck();
    await expectHighlighted(page, seed.sites.total - topic.sites);
    await cardHead(page, seed.airQuality.folder).click();
    await expectHighlighted(page, seed.airQuality.sites);
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
});

test.describe('A search explains its matches', () => {
  test('a program matched by a partner name says which partner', async ({ page }) => {
    await openHome(page);
    await searchBox(page).fill('desert research');
    const hints = page.locator('.prog__partner:visible');
    await expect(hints.first()).toHaveText('Partner: Desert Research Institute');
    // A match on the program's own name needs no explaining.
    await searchBox(page).fill('ozone');
    await expect(programLinks(page).first()).toBeVisible();
    await expect(page.locator('.prog__partner:visible')).toHaveCount(0);
  });
});

test.describe('Nav row and sections', () => {
  test('each nav item scrolls to its section, moves focus to its heading, and becomes current', async ({
    page,
  }) => {
    await openHome(page);
    await expectActiveNav(page, FIRST.nav);

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
    await navLink(page, FIRST.nav).click();
    await expect.poll(() => headingInView(page, sectionHeading(page, FIRST.heading))).toBe(true);
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
    await scrollToSection('sites');
    await expectActiveNav(page, 'Sites');
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expectActiveNav(page, LAST.nav);
    await scrollToSection('categories');
    await expectActiveNav(page, FIRST.nav);
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectActiveNav(page, FIRST.nav);
  });

  test('on a program page no nav item is current, and a nav item opens the home page at its section', async ({
    page,
  }) => {
    await page.goto(`/programs/${seed.ozone.id}`);
    await expect(page.getByRole('heading', { level: 1, name: seed.ozone.name })).toBeVisible();
    await expectActiveNav(page, null);

    await navLink(page, LAST.nav).click();
    await expect(page).toHaveURL(/\/#about$/);
    await expect(sectionHeading(page, LAST.heading)).toBeFocused();
    await expect.poll(() => headingInView(page, sectionHeading(page, LAST.heading))).toBe(true);
    await expectActiveNav(page, LAST.nav);
  });

  test('/programs and /about redirect to their sections of the home page', async ({ page }) => {
    await page.goto('/programs');
    await expect(page).toHaveURL(/\/#all-programs$/);
    await expect(listRows(page)).toHaveCount(LIST_CAP);
    await expect(sectionHeading(page, 'All Programs')).toBeFocused();
    await expect.poll(() => headingInView(page, sectionHeading(page, 'All Programs'))).toBe(true);
    await expectActiveNav(page, 'All Programs');

    await page.goto('/about');
    await expect(page).toHaveURL(/\/#about$/);
    await expect(page.locator('.goal')).toHaveCount(seed.categories);
    await expect(sectionHeading(page, LAST.heading)).toBeFocused();
    await expectActiveNav(page, LAST.nav);
  });

  test('an unknown address says the page was not found, with the way home', async ({ page }) => {
    await page.goto('/no/such/page');
    await expect(page).toHaveURL(/\/no\/such\/page$/);
    await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible();
    await expect(page).toHaveTitle('Page not found | LT Info sandbox');
    await page.getByRole('button', { name: 'Monitoring Programs', exact: true }).click();
    await expect(page).toHaveURL(/\/$/);
    await expect(cards(page)).toHaveCount(seed.categories);
  });

  test('after the end of the page and back to the top, the first section is current again', async ({ page }) => {
    await openHome(page);
    await expectActiveNav(page, FIRST.nav);
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await expectActiveNav(page, LAST.nav);
    // The top of the page shows only the hero and the headline measures in the spy's band;
    // the first section is current.
    await page.evaluate(() => window.scrollTo(0, 0));
    await expectActiveNav(page, FIRST.nav);
  });
});

test.describe('About Monitoring', () => {
  test('lists every category goal, each linking to its category', async ({ page, request }) => {
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
    await expect(goal(seed.recreation.folder).getByRole('link', { name: '1 program' })).toBeVisible();
    const link = goal(seed.waterQuality.folder).getByRole('link', { name: `${seed.waterQuality.programs} programs` });
    await expect(link).toHaveAttribute('href', `/category/${seed.waterQuality.folder}`);

    // The link opens the category's card, above.
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/category/${seed.waterQuality.folder}$`));
    await expect(cardHead(page, seed.waterQuality.folder)).toHaveAttribute('aria-expanded', 'true');
    await expect(card(page, seed.waterQuality.folder)).toBeInViewport();
  });
});

test.describe('Home page at 375 px wide', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('does not scroll sideways, and stacks the search, the cards, the map, and its legend in one column', async ({
    page,
  }) => {
    await openHome(page);

    expect(await sidewaysOverflow(page)).toBeLessThanOrEqual(0);
    // The hero runs edge to edge, with the search under the intro.
    const hero = (await page.locator('.hero').boundingBox())!;
    expect(hero.x).toBe(0);
    expect(hero.width).toBe(375);
    const intro = (await page.locator('.hero__intro').boundingBox())!;
    const find = (await page.locator('.hero__find').boundingBox())!;
    expect(find.y).toBeGreaterThan(intro.y);
    // One card across, and the map under the last card, with the legend under the map.
    const boxes = await Promise.all((await cards(page).all()).map((item) => item.boundingBox()));
    expect(new Set(boxes.map((box) => Math.round(box!.x))).size).toBe(1);
    const map = (await page.locator('.map-panel__map').boundingBox())!;
    expect(map.y).toBeGreaterThan(boxes[boxes.length - 1]!.y);
    expect(map.x + map.width).toBeLessThanOrEqual(375);
    const side = (await page.locator('.map-panel__side').boundingBox())!;
    expect(side.y).toBeGreaterThanOrEqual(map.y + map.height - 1);
    expect(side.x + side.width).toBeLessThanOrEqual(375);
    // The nav items fit.
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
  test('a clean load, a selection, and a legend change log no errors', async ({ page, consoleErrors, request }) => {
    const [topic] = topicSites(await categories(request));
    await openHome(page);
    await cardHead(page, seed.waterQuality.folder).click();
    await expectHighlighted(page, seed.waterQuality.sites);
    await cardHead(page, seed.waterQuality.folder).click();
    await legendItem(page, topic.id).getByRole('checkbox').uncheck();
    await expectHighlighted(page, seed.sites.total - topic.sites);
    await page.evaluate(() => document.fonts.ready);

    expect(consoleErrors).toEqual([]);
  });
});
