// Contract tests for Sandbox.API, called directly at API_URL with Playwright's
// request fixture. No browser is involved. Property names are PascalCase
// because the real LT Info API serializes that way.
import { expect, test } from '@playwright/test';

import { API_URL, TEMPLATES, seed } from './support';
import type { Template } from './support';

// Relative paths below resolve against the API. The trailing slash keeps a
// path prefix in API_URL, should one ever be added.
test.use({ baseURL: `${API_URL}/` });

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;
const HTTPS_URL = /^https:\/\/\S+$/;
const LOCAL_ICON_OR_HTTPS = /^(https:\/\/\S+|category-icons\/[A-Za-z]+-white-icon\.svg)$/;

const SUMMARY_KEYS = [
  'CategoryID',
  'CategoryName',
  'ImageCount',
  'IsFeatured',
  'KeyPhotoUrl',
  'MonitoringProgramID',
  'MonitoringProgramName',
  'PartnerCount',
  'PartnerNames',
  'SiteCount',
  'Template',
  'ThemeColor',
];

const DETAIL_KEYS = [
  ...SUMMARY_KEYS,
  'DashboardConfig',
  'Images',
  'MonitoringApproach',
  'MonitoringProgramDescription',
  'Partners',
  'RelatedLinks',
].sort();

const IMAGE_KEYS = ['Caption', 'IsKeyPhoto', 'MonitoringProgramImageID', 'PhotoCredit', 'Url'];

/** The only keys a DashboardConfig may carry. Each is optional. */
const CONFIG_KEYS = ['mapLayer', 'measures', 'overlays', 'siteProfile', 'sitesLayer', 'sitesPerYear'];

const CATEGORY_KEYS = [
  'Blurb',
  'CategoryDescription',
  'CategoryID',
  'CategoryName',
  'Folder',
  'IconUrl',
  'ProgramCount',
  'SiteCount',
  'ThemeColor',
];

const SITE_KEYS = [
  'Latitude',
  'Longitude',
  'MonitoringProgramID',
  'MonitoringSiteID',
  'SiteKind',
  'SiteName',
];

interface Category {
  CategoryID: number;
  CategoryName: string;
  Folder: string;
  ThemeColor: string;
  ProgramCount: number;
  Blurb: string;
  CategoryDescription: string;
  IconUrl: string | null;
  SiteCount: number;
}

interface MonitoringSite {
  MonitoringSiteID: number;
  MonitoringProgramID: number;
  SiteName: string;
  SiteKind: 'site' | 'area' | 'line';
  Latitude: number;
  Longitude: number;
}

interface ProgramSummary {
  MonitoringProgramID: number;
  MonitoringProgramName: string;
  CategoryID: number;
  CategoryName: string;
  ThemeColor: string;
  IsFeatured: boolean;
  PartnerCount: number;
  Template: Template;
  ImageCount: number;
  KeyPhotoUrl: string | null;
  SiteCount: number;
  PartnerNames: string[];
}

interface Partner {
  OrganizationID: number;
  OrganizationName: string;
  OrganizationShortName: string | null;
}

interface ProgramImage {
  MonitoringProgramImageID: number;
  Url: string;
  Caption: string | null;
  PhotoCredit: string | null;
  IsKeyPhoto: boolean;
}

interface DashboardConfig {
  measures?: { title: string; layer?: number | string; service?: string; csv?: string; json?: string; x: string; y: unknown }[];
  sitesLayer?: { layer: number | string };
  sitesPerYear?: { layer: number | string; year: string; site: string };
  mapLayer?: { layer: number | string };
  overlays?: unknown[];
  siteProfile?: { record?: { year: string; value: string }; facts?: { label: string; field: string }[] };
}

interface ProgramDetail extends ProgramSummary {
  MonitoringProgramDescription: string | null;
  MonitoringApproach: string | null;
  Partners: Partner[];
  Images: ProgramImage[];
  DashboardConfig: DashboardConfig | null;
  RelatedLinks: { Dashboard: string; Label: string; Url: string }[];
}

/** The dashboards a program page links to, and the host each one's pages live on. */
const RELATED_HOSTS: Record<string, string> = {
  'Threshold Dashboard': 'https://thresholds.laketahoeinfo.org/',
  'Climate Resilience Dashboard': 'https://climate.laketahoeinfo.org/',
  'Lake Clarity Tracker': 'https://clarity.laketahoeinfo.org/',
  'Transportation Tracker': 'https://transportation.laketahoeinfo.org/',
};

const programPath = (id: number): string => `monitoring-programs/${id}`;

const isLayerId = (value: unknown): boolean =>
  (typeof value === 'number' && Number.isInteger(value)) ||
  (typeof value === 'string' && value !== '');

/** Asserts the shape of one program's photos: key photo first, and the summary fields agree. */
function expectImages(program: ProgramDetail): void {
  const label = `program ${program.MonitoringProgramID}`;
  expect(Array.isArray(program.Images), label).toBe(true);
  expect(program.Images, label).toHaveLength(program.ImageCount);

  for (const image of program.Images) {
    expect(Object.keys(image).sort(), label).toEqual(IMAGE_KEYS);
    expect(Number.isInteger(image.MonitoringProgramImageID), label).toBe(true);
    expect(image.Url, label).toMatch(HTTPS_URL);
    expect(image.Caption === null || typeof image.Caption === 'string', label).toBe(true);
    expect(image.PhotoCredit === null || typeof image.PhotoCredit === 'string', label).toBe(true);
    expect(image.IsKeyPhoto, label).toEqual(expect.any(Boolean));
  }
  expect(
    new Set(program.Images.map((image) => image.MonitoringProgramImageID)).size,
    `${label}: image IDs are unique`,
  ).toBe(program.Images.length);

  if (program.Images.length === 0) {
    expect(program.KeyPhotoUrl, label).toBeNull();
    return;
  }
  // At most one key photo, and when there is one it comes first.
  const keyPhotos = program.Images.filter((image) => image.IsKeyPhoto);
  expect(keyPhotos.length, `${label}: at most one key photo`).toBeLessThanOrEqual(1);
  if (keyPhotos.length === 1) expect(program.Images[0].IsKeyPhoto, label).toBe(true);
  expect(program.KeyPhotoUrl, `${label}: KeyPhotoUrl is the first photo`).toBe(
    program.Images[0].Url,
  );
}

/** Asserts the shape of one program's chart and map settings. Null means none are configured. */
function expectDashboardConfig(program: ProgramDetail): void {
  const label = `program ${program.MonitoringProgramID}`;
  const config = program.DashboardConfig;
  if (config === null) return;

  expect(typeof config, label).toBe('object');
  for (const key of Object.keys(config)) expect(CONFIG_KEYS, label).toContain(key);

  if (config.measures !== undefined) {
    expect(Array.isArray(config.measures), label).toBe(true);
    for (const measure of config.measures) {
      expect(measure.title, label).toEqual(expect.any(String));
      expect(measure.title, label).not.toBe('');
      // A map service layer, or a CSV or JSON file for numbers no service publishes yet.
      expect(
        isLayerId(measure.layer) ||
          (measure.layer === undefined &&
            (/^https:\/\/\S+\.csv$/.test(String(measure.csv)) || /^data\/[\w/-]+\.json$/.test(String(measure.json)))),
        `${label}: measure layer or csv`,
      ).toBe(true);
      if (measure.service !== undefined) expect(measure.service, `${label}: measure service`).toMatch(/^https:\/\/\S+\/(MapServer|FeatureServer)$/);
      expect(measure.x, label).toEqual(expect.any(String));
      expect(typeof measure.y === 'string' || Array.isArray(measure.y), `${label}: measure y`).toBe(
        true,
      );
    }
  }
  if (config.sitesLayer !== undefined) {
    expect(isLayerId(config.sitesLayer.layer), `${label}: sitesLayer layer`).toBe(true);
  }
  if (config.mapLayer !== undefined) {
    expect(isLayerId(config.mapLayer.layer), `${label}: mapLayer layer`).toBe(true);
  }
  if (config.sitesPerYear !== undefined) {
    expect(isLayerId(config.sitesPerYear.layer), `${label}: sitesPerYear layer`).toBe(true);
    expect(config.sitesPerYear.year, label).toEqual(expect.any(String));
    expect(config.sitesPerYear.site, label).toEqual(expect.any(String));
  }
  if (config.overlays !== undefined) expect(Array.isArray(config.overlays), label).toBe(true);
  if (config.siteProfile !== undefined) {
    // What the site profile reads: an object, its record naming the year and value fields.
    expect(typeof config.siteProfile, `${label}: siteProfile`).toBe('object');
    expect(config.siteProfile, `${label}: siteProfile`).not.toBeNull();
    if (config.siteProfile.record !== undefined) {
      expect(config.siteProfile.record.year, `${label}: siteProfile record year`).toEqual(expect.any(String));
      expect(config.siteProfile.record.value, `${label}: siteProfile record value`).toEqual(expect.any(String));
    }
    if (config.siteProfile.facts !== undefined) {
      expect(Array.isArray(config.siteProfile.facts), `${label}: siteProfile facts`).toBe(true);
    }
  }
}

test.describe('Sandbox.API contract', () => {
  test('GET /health reports the database and the program count', async ({ request }) => {
    const response = await request.get('health');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual({
      Status: 'ok',
      Database: seed.database,
      ProgramCount: seed.programs,
    });
  });

  test('GET /categories returns every category in the documented shape', async ({ request }) => {
    const response = await request.get('categories');
    expect(response.status()).toBe(200);
    const categories = (await response.json()) as Category[];

    expect(categories).toHaveLength(seed.categories);
    for (const category of categories) {
      expect(Object.keys(category).sort()).toEqual(CATEGORY_KEYS);
      expect(Number.isInteger(category.CategoryID)).toBe(true);
      expect(category.CategoryName).toEqual(expect.any(String));
      expect(category.CategoryName).not.toBe('');
      expect(category.Folder).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
      expect(category.ThemeColor).toMatch(HEX_COLOR);
      expect(Number.isInteger(category.ProgramCount)).toBe(true);
      expect(category.ProgramCount).toBeGreaterThanOrEqual(0);
    }

    // IDs are unique, and the per-category counts add up to every program.
    expect(new Set(categories.map((category) => category.CategoryID)).size).toBe(seed.categories);
    expect(categories.reduce((sum, category) => sum + category.ProgramCount, 0)).toBe(
      seed.programs,
    );
    expect(categories.find((category) => category.CategoryName === seed.ozone.category)).toEqual(
      expect.objectContaining({ ProgramCount: seed.airQualityPrograms }),
    );
  });

  test('GET /monitoring-programs returns 90 programs in the documented shape', async ({
    request,
  }) => {
    const [programsResponse, categoriesResponse] = await Promise.all([
      request.get('monitoring-programs'),
      request.get('categories'),
    ]);
    expect(programsResponse.status()).toBe(200);
    const programs = (await programsResponse.json()) as ProgramSummary[];
    const categories = (await categoriesResponse.json()) as Category[];
    const categoryNames = new Map(
      categories.map((category) => [category.CategoryID, category.CategoryName]),
    );

    expect(programs).toHaveLength(seed.programs);
    for (const program of programs) {
      expect(Object.keys(program).sort()).toEqual(SUMMARY_KEYS);
      expect(Number.isInteger(program.MonitoringProgramID)).toBe(true);
      expect(program.MonitoringProgramName).toEqual(expect.any(String));
      expect(program.MonitoringProgramName).not.toBe('');
      expect(program.ThemeColor).toMatch(HEX_COLOR);
      expect(program.IsFeatured).toEqual(expect.any(Boolean));
      expect(Number.isInteger(program.PartnerCount)).toBe(true);
      // Every program points at a category that /categories also returns.
      expect(categoryNames.get(program.CategoryID)).toBe(program.CategoryName);
    }

    expect(new Set(programs.map((program) => program.MonitoringProgramID)).size).toBe(
      seed.programs,
    );
    // Compared by ID, so when the database is not in its seeded state the
    // failure names the program that was switched on or off.
    const featuredIds = programs
      .filter((program) => program.IsFeatured)
      .map((program) => program.MonitoringProgramID)
      .sort((a, b) => a - b);
    expect(featuredIds, 'featured program IDs, compared with seed.sql').toEqual([
      ...seed.featuredIds,
    ]);
    expect(featuredIds).toHaveLength(seed.featured);
    expect(programs.reduce((sum, program) => sum + program.PartnerCount, 0)).toBe(
      seed.partnerLinks,
    );
  });

  test('GET /monitoring-programs gives each program a Template, an ImageCount, and a KeyPhotoUrl', async ({
    request,
  }) => {
    const programs = (await (await request.get('monitoring-programs')).json()) as ProgramSummary[];

    for (const program of programs) {
      const label = `program ${program.MonitoringProgramID}`;
      expect(TEMPLATES, label).toContain(program.Template);
      expect(Number.isInteger(program.ImageCount), label).toBe(true);
      expect(program.ImageCount, label).toBeGreaterThanOrEqual(0);
      // A program with photos names one of them; a program without has null.
      if (program.ImageCount > 0) expect(program.KeyPhotoUrl, label).toMatch(HTTPS_URL);
      else expect(program.KeyPhotoUrl, label).toBeNull();
    }

    // 13 map, 18 charts, and 5 context.
    const count = (template: Template): number =>
      programs.filter((program) => program.Template === template).length;
    expect({ map: count('map'), charts: count('charts'), context: count('context') }).toEqual(
      seed.templates,
    );

    // 66 photos across 39 programs.
    expect(programs.reduce((sum, program) => sum + program.ImageCount, 0)).toBe(seed.photos);
    expect(programs.filter((program) => program.ImageCount > 0)).toHaveLength(
      seed.programsWithPhotos,
    );

    // The four programs the page tests open are seeded with the layout each test expects.
    for (const expected of [
      seed.ozone,
      seed.yellowCress,
      seed.nearshoreHealth,
      seed.standComposition,
    ]) {
      expect(programs.find((program) => program.MonitoringProgramID === expected.id)).toEqual(
        expect.objectContaining({
          MonitoringProgramName: expected.name,
          Template: expected.template,
          ImageCount: expected.photos,
        }),
      );
    }
  });

  test('GET /monitoring-programs/41 returns the Ozone detail with its partners', async ({
    request,
  }) => {
    const response = await request.get(programPath(seed.ozone.id));
    expect(response.status()).toBe(200);
    const program = (await response.json()) as ProgramDetail;

    expect(Object.keys(program).sort()).toEqual(DETAIL_KEYS);
    expect(program).toEqual(
      expect.objectContaining({
        MonitoringProgramID: seed.ozone.id,
        MonitoringProgramName: seed.ozone.name,
        CategoryName: seed.ozone.category,
        IsFeatured: seed.ozone.isFeatured,
        PartnerCount: seed.ozone.partners,
        MonitoringProgramDescription: null,
        Template: seed.ozone.template,
        ImageCount: seed.ozone.photos,
      }),
    );
    expect(program.ThemeColor).toMatch(HEX_COLOR);
    expect(program.MonitoringApproach).toEqual(expect.any(String));

    expect(program.Partners).toHaveLength(seed.ozone.partners);
    for (const partner of program.Partners) {
      expect(Object.keys(partner).sort()).toEqual([
        'OrganizationID',
        'OrganizationName',
        'OrganizationShortName',
      ]);
      expect(Number.isInteger(partner.OrganizationID)).toBe(true);
      expect(partner.OrganizationName).toEqual(expect.any(String));
      expect(partner.OrganizationName).not.toBe('');
      expect(
        partner.OrganizationShortName === null || typeof partner.OrganizationShortName === 'string',
      ).toBe(true);
    }
    expect(new Set(program.Partners.map((partner) => partner.OrganizationID)).size).toBe(
      seed.ozone.partners,
    );
  });

  test('GET /monitoring-programs/41 returns its photo and its chart and map settings', async ({
    request,
  }) => {
    const program = (await (await request.get(programPath(seed.ozone.id))).json()) as ProgramDetail;

    // One photo, which is the key photo, with a caption and a credit.
    expectImages(program);
    expect(program.Images).toHaveLength(seed.ozone.photos);
    expect(program.Images[0]).toEqual(
      expect.objectContaining({
        IsKeyPhoto: true,
        Caption: expect.any(String),
        PhotoCredit: expect.any(String),
      }),
    );

    // Two measures, a sites layer, and a sites-per-year count: three charts and one map.
    expectDashboardConfig(program);
    const config = program.DashboardConfig;
    expect(config).not.toBeNull();
    expect(config!.measures).toHaveLength(seed.ozone.chartPanels - 1);
    expect(config!.sitesLayer).toEqual(expect.any(Object));
    expect(config!.sitesPerYear).toEqual(expect.any(Object));
  });

  test('GET /monitoring-programs/9681 returns no photos, and 9621 no chart or map settings', async ({
    request,
  }) => {
    const program = (await (
      await request.get(programPath(seed.standComposition.id))
    ).json()) as ProgramDetail;

    expect(Object.keys(program).sort()).toEqual(DETAIL_KEYS);
    expect(program).toEqual(
      expect.objectContaining({
        MonitoringProgramName: seed.standComposition.name,
        Template: 'context',
        ImageCount: 0,
        KeyPhotoUrl: null,
        Images: [],
      }),
    );
    const bare = (await (await request.get(programPath(seed.instreamFlow.id))).json()) as ProgramDetail;
    expect(bare).toEqual(expect.objectContaining({ MonitoringProgramName: seed.instreamFlow.name, DashboardConfig: null }));
  });

  test('every program detail carries Images and DashboardConfig in the documented shape', async ({
    request,
  }) => {
    const summaries = (await (
      await request.get('monitoring-programs')
    ).json()) as ProgramSummary[];
    const details: ProgramDetail[] = [];
    for (const summary of summaries) {
      const response = await request.get(programPath(summary.MonitoringProgramID));
      expect(response.status(), `program ${summary.MonitoringProgramID}`).toBe(200);
      details.push((await response.json()) as ProgramDetail);
    }

    for (const [index, program] of details.entries()) {
      expect(Object.keys(program).sort()).toEqual(DETAIL_KEYS);
      // The detail repeats the summary fields with the same values.
      expect(program).toEqual(expect.objectContaining(summaries[index]));
      expectImages(program);
      expectDashboardConfig(program);
      // Links to the other dashboards: a known dashboard, a page on its host, no repeats.
      for (const link of program.RelatedLinks) {
        expect(Object.keys(link).sort()).toEqual(['Dashboard', 'Label', 'Url']);
        expect(link.Label).not.toBe('');
        expect(link.Url.startsWith(RELATED_HOSTS[link.Dashboard] ?? 'unknown dashboard')).toBe(true);
      }
      expect(new Set(program.RelatedLinks.map((link) => link.Url)).size).toBe(program.RelatedLinks.length);
    }
    // The climate pages link back to their Climate Resilience Dashboard outcome.
    const lakeLevel = details.find((program) => program.MonitoringProgramID === seed.lakeLevel.id)!;
    expect(lakeLevel.RelatedLinks).toContainEqual({
      Dashboard: 'Climate Resilience Dashboard',
      Label: 'Lake Conditions',
      Url: 'https://climate.laketahoeinfo.org/lake-conditions',
    });

    // The photos, counted from the photos themselves.
    expect(details.reduce((sum, program) => sum + program.Images.length, 0)).toBe(seed.photos);
    expect(details.filter((program) => program.Images.length > 0)).toHaveLength(
      seed.programsWithPhotos,
    );
    // No photo file is listed twice.
    const imageIds = details.flatMap((program) =>
      program.Images.map((image) => image.MonitoringProgramImageID),
    );
    expect(new Set(imageIds).size).toBe(seed.photos);
  });

  test('GET /summary returns the four home page totals and the photo count', async ({
    request,
  }) => {
    const response = await request.get('summary');

    expect(response.status()).toBe(200);
    expect(response.headers()['content-type']).toContain('application/json');
    expect(await response.json()).toEqual({
      ProgramCount: seed.summary.programs,
      CategoryCount: seed.summary.categories,
      MappedSiteCount: seed.summary.mappedSites,
      PartnerCount: seed.summary.partners,
      PhotoCount: seed.summary.photos,
    });
  });

  test('GET /categories gives each category a blurb, a goal, an icon, and a site count', async ({
    request,
  }) => {
    const categories = (await (await request.get('categories')).json()) as Category[];

    for (const category of categories) {
      const label = category.CategoryName;
      expect(category.Blurb, label).toEqual(expect.any(String));
      expect(category.Blurb.trim(), label).not.toBe('');
      expect(category.CategoryDescription, label).toEqual(expect.any(String));
      expect(category.CategoryDescription.trim(), label).not.toBe('');
      // A Threshold Dashboard icon, or one of the web app's own for categories it has none for.
      expect(category.IconUrl ?? '', label).toMatch(LOCAL_ICON_OR_HTTPS);
      expect(Number.isInteger(category.SiteCount), label).toBe(true);
      expect(category.SiteCount, label).toBeGreaterThanOrEqual(0);
    }

    // The per-category site counts add up to every mapped site.
    expect(categories.reduce((sum, category) => sum + category.SiteCount, 0)).toBe(
      seed.summary.mappedSites,
    );
    const byName = new Map(categories.map((category) => [category.CategoryName, category]));
    for (const expected of [seed.airQuality, seed.waterQuality, seed.recreation]) {
      expect(byName.get(expected.name)).toEqual(
        expect.objectContaining({
          Folder: expected.folder,
          ProgramCount: expected.programs,
          SiteCount: expected.sites,
        }),
      );
    }
  });

  test('GET /monitoring-programs gives each program a SiteCount and its PartnerNames', async ({
    request,
  }) => {
    const programs = (await (await request.get('monitoring-programs')).json()) as ProgramSummary[];
    const categories = (await (await request.get('categories')).json()) as Category[];

    for (const program of programs) {
      const label = `program ${program.MonitoringProgramID}`;
      expect(Number.isInteger(program.SiteCount), label).toBe(true);
      expect(program.SiteCount, label).toBeGreaterThanOrEqual(0);
      expect(Array.isArray(program.PartnerNames), label).toBe(true);
      expect(program.PartnerNames, label).toHaveLength(program.PartnerCount);
      for (const name of program.PartnerNames) {
        expect(name, label).toEqual(expect.any(String));
        expect(name.trim(), label).not.toBe('');
      }
    }

    expect(programs.reduce((sum, program) => sum + program.SiteCount, 0)).toBe(
      seed.summary.mappedSites,
    );
    // The partner total in /summary counts distinct organizations.
    expect(new Set(programs.flatMap((program) => program.PartnerNames)).size).toBe(
      seed.summary.partners,
    );
    // Each category's SiteCount is the sum over its programs.
    for (const category of categories) {
      const sum = programs
        .filter((program) => program.CategoryID === category.CategoryID)
        .reduce((total, program) => total + program.SiteCount, 0);
      expect(sum, category.CategoryName).toBe(category.SiteCount);
    }
  });

  test('GET /monitoring-sites returns 1,750 points: 789 sites, 927 areas, and 34 lines', async ({
    request,
  }) => {
    const sitesResponse = await request.get('monitoring-sites');
    expect(sitesResponse.status()).toBe(200);
    expect(sitesResponse.headers()['content-type']).toContain('application/json');
    const sites = (await sitesResponse.json()) as MonitoringSite[];
    const programs = (await (await request.get('monitoring-programs')).json()) as ProgramSummary[];
    const programIds = new Set(programs.map((program) => program.MonitoringProgramID));

    expect(sites).toHaveLength(seed.sites.total);
    for (const site of sites) {
      const label = `site ${site.MonitoringSiteID}`;
      expect(Object.keys(site).sort(), label).toEqual(SITE_KEYS);
      expect(Number.isInteger(site.MonitoringSiteID), label).toBe(true);
      expect(programIds.has(site.MonitoringProgramID), `${label}: a known program`).toBe(true);
      expect(['site', 'area', 'line'], label).toContain(site.SiteKind);
      expect(typeof site.SiteName, label).toBe('string');
      // In and around the Lake Tahoe Region.
      expect(site.Latitude, label).toBeGreaterThan(38.5);
      expect(site.Latitude, label).toBeLessThan(39.6);
      expect(site.Longitude, label).toBeGreaterThan(-120.6);
      expect(site.Longitude, label).toBeLessThan(-119.5);
    }
    expect(new Set(sites.map((site) => site.MonitoringSiteID)).size).toBe(seed.sites.total);

    const kinds = { site: 0, area: 0, line: 0 };
    for (const site of sites) kinds[site.SiteKind] += 1;
    expect(kinds).toEqual({ site: seed.sites.site, area: seed.sites.area, line: seed.sites.line });

    // Each program's SiteCount is the number of points it has here.
    const perProgram = new Map<number, number>();
    for (const site of sites) {
      perProgram.set(site.MonitoringProgramID, (perProgram.get(site.MonitoringProgramID) ?? 0) + 1);
    }
    for (const program of programs) {
      expect(perProgram.get(program.MonitoringProgramID) ?? 0, `program ${program.MonitoringProgramID}`).toBe(
        program.SiteCount,
      );
    }
  });

  test('GET /dashboard-configs returns the settings of every program that has them, in ID order', async ({
    request,
  }) => {
    const response = await request.get('dashboard-configs');
    expect(response.status()).toBe(200);
    const rows = (await response.json()) as { MonitoringProgramID: number; DashboardConfig: Record<string, unknown> }[];

    expect(rows.length).toBeGreaterThan(0);
    const ids = rows.map((row) => row.MonitoringProgramID);
    expect(ids).toEqual([...ids].sort((a, b) => a - b));
    for (const row of rows) {
      expect(Object.keys(row).sort()).toEqual(['DashboardConfig', 'MonitoringProgramID']);
      expect(row.DashboardConfig).not.toBeNull();
    }

    // The same settings the program's own route returns.
    const ozone = rows.find((row) => row.MonitoringProgramID === seed.ozone.id)!;
    const detail = (await (await request.get(`monitoring-programs/${seed.ozone.id}`)).json()) as {
      DashboardConfig: Record<string, unknown>;
    };
    expect(ozone.DashboardConfig).toEqual(detail.DashboardConfig);

    // A program with no settings is left out.
    expect(ids).not.toContain(seed.instreamFlow.id);
  });

  test('GET /monitoring-programs/{id} answers 404 for an unknown id', async ({ request }) => {
    const response = await request.get(programPath(seed.unknownId));

    expect(response.status()).toBe(404);
    expect(response.headers()['content-type']).toContain('application/problem+json');
    expect(await response.json()).toEqual(expect.objectContaining({ status: 404 }));
  });

  test('PATCH /monitoring-programs/{id} answers 404 for an unknown id', async ({ request }) => {
    const response = await request.patch(programPath(seed.unknownId), {
      data: { IsFeatured: true },
    });

    expect(response.status()).toBe(404);
  });

  test('PATCH /monitoring-programs/{id} rejects a value that is not a boolean', async ({
    request,
  }) => {
    const before = (await (await request.get(programPath(seed.ozone.id))).json()) as ProgramDetail;

    const response = await request.patch(programPath(seed.ozone.id), {
      data: { IsFeatured: 'yes' },
    });
    expect(response.status()).toBe(400);

    // A refused request changes nothing.
    const after = (await (await request.get(programPath(seed.ozone.id))).json()) as ProgramDetail;
    expect(after.IsFeatured).toBe(before.IsFeatured);
  });

  test('PATCH /monitoring-programs/{id} answers 400 for an unknown template', async ({
    request,
  }) => {
    const path = programPath(seed.ozone.id);
    const before = (await (await request.get(path)).json()) as ProgramDetail;

    for (const value of ['grid', 'Map', '', 5]) {
      const response = await request.patch(path, { data: { Template: value } });
      expect(response.status(), `Template: ${JSON.stringify(value)}`).toBe(400);
    }

    // A refused request changes nothing.
    const after = (await (await request.get(path)).json()) as ProgramDetail;
    expect(after).toEqual(before);
  });

  test('GET /openapi/v1.json lists the seven paths and their methods', async ({ request }) => {
    const response = await request.get('openapi/v1.json');
    expect(response.status()).toBe(200);
    const document = (await response.json()) as {
      openapi: string;
      paths: Record<string, Record<string, unknown>>;
    };

    expect(document.openapi).toMatch(/^3\./);

    // The name inside the braces is the API's own choice, so compare with it normalized.
    const methodsByPath = new Map(
      Object.entries(document.paths).map(([path, item]) => [
        path.replace(/\{[^}]+\}/g, '{id}'),
        Object.keys(item).sort(),
      ]),
    );
    expect([...methodsByPath.keys()].sort()).toEqual([
      '/categories',
      '/dashboard-configs',
      '/health',
      '/monitoring-programs',
      '/monitoring-programs/{id}',
      '/monitoring-sites',
      '/summary',
    ]);
    expect(methodsByPath.get('/health')).toEqual(['get']);
    expect(methodsByPath.get('/categories')).toEqual(['get']);
    expect(methodsByPath.get('/dashboard-configs')).toEqual(['get']);
    expect(methodsByPath.get('/monitoring-programs')).toEqual(['get']);
    expect(methodsByPath.get('/monitoring-programs/{id}')).toEqual(['get', 'patch']);
    expect(methodsByPath.get('/monitoring-sites')).toEqual(['get']);
    expect(methodsByPath.get('/summary')).toEqual(['get']);
  });

  test('PATCH /monitoring-programs/41 saves IsFeatured, reads back, and is restored', async ({
    request,
  }) => {
    const path = programPath(seed.ozone.id);
    const original = (await (await request.get(path)).json()) as ProgramDetail;
    const flipped = !original.IsFeatured;
    const featuredBefore = (
      (await (await request.get('monitoring-programs')).json()) as ProgramSummary[]
    ).filter((program) => program.IsFeatured).length;

    try {
      // Set: the response is the updated detail.
      const patch = await request.patch(path, { data: { IsFeatured: flipped } });
      expect(patch.status()).toBe(200);
      const saved = (await patch.json()) as ProgramDetail;
      expect(Object.keys(saved).sort()).toEqual(DETAIL_KEYS);
      expect(saved).toEqual({ ...original, IsFeatured: flipped });

      // Read back: both the detail and the list show the saved value.
      const detail = (await (await request.get(path)).json()) as ProgramDetail;
      expect(detail.IsFeatured).toBe(flipped);
      const programs = (await (
        await request.get('monitoring-programs')
      ).json()) as ProgramSummary[];
      expect(programs.find((program) => program.MonitoringProgramID === seed.ozone.id)).toEqual(
        expect.objectContaining({ IsFeatured: flipped }),
      );
      expect(programs.filter((program) => program.IsFeatured)).toHaveLength(
        featuredBefore + (flipped ? 1 : -1),
      );
    } finally {
      // Leave the database as found, even when an assertion above failed.
      const restore = await request.patch(path, { data: { IsFeatured: original.IsFeatured } });
      expect(restore.status(), 'restoring the original IsFeatured value').toBe(200);
    }

    const restored = (await (await request.get(path)).json()) as ProgramDetail;
    expect(restored).toEqual(original);
    const programs = (await (await request.get('monitoring-programs')).json()) as ProgramSummary[];
    expect(programs.filter((program) => program.IsFeatured)).toHaveLength(featuredBefore);
  });

  test('PATCH /monitoring-programs/41 saves Template, reads back, and is restored', async ({
    request,
  }) => {
    const path = programPath(seed.ozone.id);
    const original = (await (await request.get(path)).json()) as ProgramDetail;
    const countOf = async (template: Template): Promise<number> =>
      ((await (await request.get('monitoring-programs')).json()) as ProgramSummary[]).filter(
        (program) => program.Template === template,
      ).length;
    const others = TEMPLATES.filter((template) => template !== original.Template);
    const originalCountBefore = await countOf(original.Template);

    try {
      // Each of the other two layouts in turn, so every stored value is written once.
      for (const template of others) {
        const patch = await request.patch(path, { data: { Template: template } });
        expect(patch.status(), `Template: ${template}`).toBe(200);
        const saved = (await patch.json()) as ProgramDetail;
        // Only the layout changes: the photos, the settings, and Featured are untouched.
        expect(saved).toEqual({ ...original, Template: template });

        // Read back: both the detail and the list show the saved layout.
        const detail = (await (await request.get(path)).json()) as ProgramDetail;
        expect(detail.Template).toBe(template);
        const programs = (await (
          await request.get('monitoring-programs')
        ).json()) as ProgramSummary[];
        expect(programs.find((program) => program.MonitoringProgramID === seed.ozone.id)).toEqual(
          expect.objectContaining({ Template: template }),
        );
        expect(await countOf(original.Template)).toBe(originalCountBefore - 1);
      }
    } finally {
      // Leave the database as found, even when an assertion above failed.
      const restore = await request.patch(path, { data: { Template: original.Template } });
      expect(restore.status(), 'restoring the original Template value').toBe(200);
    }

    const restored = (await (await request.get(path)).json()) as ProgramDetail;
    expect(restored).toEqual(original);
    expect(await countOf(original.Template)).toBe(originalCountBefore);
  });
});
