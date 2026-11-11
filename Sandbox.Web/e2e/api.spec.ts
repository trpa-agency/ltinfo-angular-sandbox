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

const SUMMARY_KEYS = [
  'CategoryID',
  'CategoryName',
  'ImageCount',
  'IsFeatured',
  'KeyPhotoUrl',
  'MonitoringProgramID',
  'MonitoringProgramName',
  'PartnerCount',
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
].sort();

const IMAGE_KEYS = ['Caption', 'IsKeyPhoto', 'MonitoringProgramImageID', 'PhotoCredit', 'Url'];

/** The only keys a DashboardConfig may carry. Each is optional. */
const CONFIG_KEYS = ['mapLayer', 'measures', 'overlays', 'sitesLayer', 'sitesPerYear'];

interface Category {
  CategoryID: number;
  CategoryName: string;
  Folder: string;
  ThemeColor: string;
  ProgramCount: number;
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
  measures?: { title: string; layer: number | string; x: string; y: unknown }[];
  sitesLayer?: { layer: number | string };
  sitesPerYear?: { layer: number | string; year: string; site: string };
  mapLayer?: { layer: number | string };
  overlays?: unknown[];
}

interface ProgramDetail extends ProgramSummary {
  MonitoringProgramDescription: string | null;
  MonitoringApproach: string | null;
  Partners: Partner[];
  Images: ProgramImage[];
  DashboardConfig: DashboardConfig | null;
}

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
      expect(isLayerId(measure.layer), `${label}: measure layer`).toBe(true);
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

  test('GET /categories returns 10 categories in the documented shape', async ({ request }) => {
    const response = await request.get('categories');
    expect(response.status()).toBe(200);
    const categories = (await response.json()) as Category[];

    expect(categories).toHaveLength(seed.categories);
    for (const category of categories) {
      expect(Object.keys(category).sort()).toEqual([
        'CategoryID',
        'CategoryName',
        'Folder',
        'ProgramCount',
        'ThemeColor',
      ]);
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

  test('GET /monitoring-programs returns 36 programs in the documented shape', async ({
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

    // 55 photos across 28 programs.
    expect(programs.reduce((sum, program) => sum + program.ImageCount, 0)).toBe(seed.photos);
    expect(programs.filter((program) => program.ImageCount > 0)).toHaveLength(
      seed.programsWithPhotos,
    );

    // The four programs the page tests open are seeded with the layout each test expects.
    for (const expected of [
      seed.ozone,
      seed.yellowCress,
      seed.socioEconomic,
      seed.subalpineConifer,
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

  test('GET /monitoring-programs/83 returns no photos and no chart or map settings', async ({
    request,
  }) => {
    const program = (await (
      await request.get(programPath(seed.subalpineConifer.id))
    ).json()) as ProgramDetail;

    expect(Object.keys(program).sort()).toEqual(DETAIL_KEYS);
    expect(program).toEqual(
      expect.objectContaining({
        MonitoringProgramName: seed.subalpineConifer.name,
        Template: 'context',
        ImageCount: 0,
        KeyPhotoUrl: null,
        Images: [],
        DashboardConfig: null,
      }),
    );
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
    }

    // 55 photos across 28 programs, counted from the photos themselves.
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

  test('GET /openapi/v1.json lists the four paths and their methods', async ({ request }) => {
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
      '/health',
      '/monitoring-programs',
      '/monitoring-programs/{id}',
    ]);
    expect(methodsByPath.get('/health')).toEqual(['get']);
    expect(methodsByPath.get('/categories')).toEqual(['get']);
    expect(methodsByPath.get('/monitoring-programs')).toEqual(['get']);
    expect(methodsByPath.get('/monitoring-programs/{id}')).toEqual(['get', 'patch']);
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
