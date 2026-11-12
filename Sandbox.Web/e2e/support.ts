// Shared by both spec files: the two targets, the seed facts the tests count
// on, and a page fixture that fails any browser test that logs a console error.
import { test as base, expect } from '@playwright/test';
import type { Page } from '@playwright/test';

const trimSlash = (url: string): string => url.replace(/\/+$/, '');

/** The web app. Page tests use relative paths, which Playwright joins to this. */
export const BASE_URL = trimSlash(process.env.BASE_URL ?? 'http://sandbox.web:4200');

/** The API, called directly, not through the /api proxy of the web app. */
export const API_URL = trimSlash(process.env.API_URL ?? 'http://sandbox.api:8080');

/** The three page layouts, as the API stores them. The page calls "context" the Content layout. */
export const TEMPLATES = ['map', 'charts', 'context'] as const;
export type Template = (typeof TEMPLATES)[number];

/** What a reader sees for each stored layout value. */
export const TEMPLATE_LABELS: Record<Template, string> = {
  map: 'Map',
  charts: 'Charts',
  context: 'Content',
};

/** What Sandbox.Database seeds. Change a number here when the seed changes. */
export const seed = {
  database: 'LTInfoSandbox',
  programs: 90,
  categories: 11,
  featured: 17,
  /** The 17 programs seed.sql marks IsFeatured = 1, so a stray one is named in the failure. */
  featuredIds: [13, 16, 33, 34, 36, 39, 61, 62, 63, 64, 65, 66, 68, 69, 76, 77, 82],
  partnerLinks: 261,
  /** How many programs use each page layout. */
  templates: { map: 36, charts: 44, context: 10 },
  /** Program photos: 66 files across 39 programs; the other 51 programs have none. */
  photos: 66,
  programsWithPhotos: 39,
  /** The charts layout, and the program the detail and write tests use. One photo. */
  ozone: {
    id: 41,
    name: 'Ozone (O3)',
    category: 'Air Quality',
    partners: 6,
    isFeatured: false,
    template: 'charts',
    photos: 1,
    /** Two measures, plus the sites-monitored-each-year chart. */
    chartPanels: 3,
    sitesPanels: 1,
  },
  /** The map layout. Four photos: the key photo and three in the gallery. */
  yellowCress: {
    id: 39,
    name: 'Tahoe Yellow Cress Monitoring',
    category: 'Biodiversity',
    template: 'map',
    photos: 4,
    chartPanels: 3,
    sitesPanels: 1,
  },
  /** The content layout, with one photo and no charts or map configured. */
  socioEconomic: {
    id: 68,
    name: 'Socio-Economic',
    category: 'Demographics',
    template: 'context',
    photos: 1,
  },
  /** The content layout with no photo and one chart, from a JSON file: a page built from a threshold indicator. */
  standComposition: {
    id: 9681,
    name: 'Stand Composition and Age',
    category: 'Forest Structure',
    template: 'context',
    photos: 0,
    chartPanels: 1,
  },
  /** A page with no chart or map settings at all. */
  instreamFlow: {
    id: 9621,
    name: 'Instream Flow',
    category: 'Biodiversity',
    template: 'context',
  },
  airQualityPrograms: 9,
  unknownId: 999999,
  /** GET /summary, and the four totals in the home page hero. */
  summary: { programs: 90, categories: 11, mappedSites: 1750, partners: 51, photos: 66 },
  /** GET /monitoring-sites: one point per site, and one per mapped area or line. */
  sites: { total: 1750, site: 789, area: 927, line: 34 },
  /** Three categories the home page tests open. Folder is the /category/:folder address. */
  airQuality: { name: 'Air Quality', folder: 'air-quality', programs: 9, sites: 30 },
  waterQuality: { name: 'Water Quality', folder: 'water-quality', programs: 13, sites: 350 },
  /** One program and no mapped sites. */
  recreation: { name: 'Recreation', folder: 'recreation', programs: 1, sites: 0, program: 'Recreation Threshold Monitoring' },
  /** A Water Quality program with mapped sites, for the program hover. */
  periphyton: { id: 13, name: 'Periphyton', sites: 54 },
} as const;

/** The home page sections, in page order, with the nav item that scrolls to each. */
export const HOME_SECTIONS = [
  { id: 'categories', nav: 'Monitoring Programs', heading: 'Threshold Categories' },
  { id: 'all-programs', nav: 'All Programs', heading: 'All Programs' },
  { id: 'about', nav: 'About Monitoring', heading: 'About Monitoring' },
] as const;

/** The face of Ecology's default theme, which the app uses (no data-theme attribute). */
export const FONT_FAMILY = 'DM Sans';
export const FONT_PATTERN = /DM Sans/;

/** The data color every mapped site is drawn in; containers and categories stay neutral. */
export const DATA_COLOR_TOKEN = '--color-background-dataviz-categorical-1';

/** True once the theme face's files have arrived, not only been asked for. */
export async function fontLoaded(page: Page): Promise<boolean> {
  return page.evaluate(async (family) => {
    await document.fonts.ready;
    return [...document.fonts].some(
      (face) => face.family.replace(/["']/g, '') === family && face.status === 'loaded',
    );
  }, FONT_FAMILY);
}

/**
 * What a color token resolves to on the page, as the browser writes a computed color
 * (rgb(...) or color(display-p3 ...)), so it compares equal to toHaveCSS values.
 */
export async function resolvedColor(page: Page, token: string): Promise<string> {
  return page.evaluate((name) => {
    const probe = document.createElement('span');
    probe.style.backgroundColor = `var(${name})`;
    document.body.append(probe);
    const color = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return color;
  }, token);
}

/**
 * How long a data panel may take to leave "loading". The panels read the TRPA
 * map service, a live server outside the sandbox.
 */
// Two minutes: the map service is live and its speed varies; the daily ozone layer alone is
// about 9 pages of 2,000 rows, and a page has taken 7 seconds on a slow day.
export const PANEL_TIMEOUT_MS = 120_000;

interface ConsoleFixtures {
  /**
   * Staff mode (the layout control, Program Settings, the layout column and filter, the
   * connection footer). On for most tests, which exercise those controls; visitor.spec.ts turns
   * it off to check what the public sees.
   */
  staff: boolean;
  /** Console errors a test expects. Anything else fails the test. */
  allowedConsoleErrors: RegExp[];
  /** Every console error and uncaught exception the page has raised so far. */
  consoleErrors: string[];
}

export const test = base.extend<ConsoleFixtures>({
  // Navigation waits for the document, not the load event. Load also waits on images from
  // outside hosts (LT Info key photos have taken 18 seconds), which would fail a test for
  // their speed; every test waits for what the reader sees instead.
  staff: [true, { option: true }],

  page: async ({ page, staff }, use) => {
    if (staff) await page.addInitScript(() => window.localStorage.setItem('mon-staff', '1'));
    const goto = page.goto.bind(page);
    page.goto = (url, options) => goto(url, { waitUntil: 'domcontentloaded', ...options });
    await use(page);
  },

  allowedConsoleErrors: [[], { option: true }],

  // Automatic: every browser test collects errors, and fails after its last
  // step if one arrived that the test did not list as expected. Warnings (the
  // esa-select deprecation notice, for one) are not errors and are ignored.
  consoleErrors: [
    async ({ page, allowedConsoleErrors }, use) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') {
          errors.push(`${message.text()} [${message.location().url}]`);
        }
      });
      page.on('pageerror', (error) => errors.push(`uncaught: ${error.message}`));

      await use(errors);

      const unexpected = errors.filter(
        (line) => !allowedConsoleErrors.some((pattern) => pattern.test(line)),
      );
      expect(unexpected, 'console errors the test did not expect').toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
