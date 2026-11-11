// Shared by both spec files: the two targets, the seed facts the tests count
// on, and a page fixture that fails any browser test that logs a console error.
import { test as base, expect } from '@playwright/test';

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
  programs: 36,
  categories: 10,
  featured: 17,
  /** The 17 programs seed.sql marks IsFeatured = 1, so a stray one is named in the failure. */
  featuredIds: [13, 16, 33, 34, 36, 39, 61, 62, 63, 64, 65, 66, 68, 69, 76, 77, 82],
  partnerLinks: 134,
  /** How many programs use each page layout. */
  templates: { map: 13, charts: 18, context: 5 },
  /** Program photos: 55 files across 28 programs; the other 8 programs have none. */
  photos: 55,
  programsWithPhotos: 28,
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
    category: 'Vegetation Preservation',
    template: 'map',
    photos: 4,
    chartPanels: 3,
    sitesPanels: 1,
  },
  /** The content layout, with one photo and no charts or map configured. */
  socioEconomic: {
    id: 68,
    name: 'Socio-Economic',
    category: 'Transportation and Sustainable Communities',
    template: 'context',
    photos: 1,
  },
  /** The content layout with no photo at all. */
  subalpineConifer: {
    id: 83,
    name: 'Subalpine Conifer',
    category: 'Vegetation Preservation',
    template: 'context',
    photos: 0,
  },
  airQualityPrograms: 5,
  unknownId: 999999,
} as const;

/**
 * How long a data panel may take to leave "loading". The panels read the TRPA
 * map service, a live server outside the sandbox.
 */
export const PANEL_TIMEOUT_MS = 60_000;

interface ConsoleFixtures {
  /** Console errors a test expects. Anything else fails the test. */
  allowedConsoleErrors: RegExp[];
  /** Every console error and uncaught exception the page has raised so far. */
  consoleErrors: string[];
}

export const test = base.extend<ConsoleFixtures>({
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
