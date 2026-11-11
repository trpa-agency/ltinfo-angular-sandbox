// Contract tests for Sandbox.API, called directly at API_URL with Playwright's
// request fixture. No browser is involved. Property names are PascalCase
// because the real LT Info API serializes that way.
import { expect, test } from '@playwright/test';

import { API_URL, seed } from './support';

// Relative paths below resolve against the API. The trailing slash keeps a
// path prefix in API_URL, should one ever be added.
test.use({ baseURL: `${API_URL}/` });

const HEX_COLOR = /^#[0-9A-Fa-f]{6}$/;

const SUMMARY_KEYS = [
  'CategoryID',
  'CategoryName',
  'IsFeatured',
  'MonitoringProgramID',
  'MonitoringProgramName',
  'PartnerCount',
  'ThemeColor',
];

const DETAIL_KEYS = [
  ...SUMMARY_KEYS,
  'MonitoringApproach',
  'MonitoringProgramDescription',
  'Partners',
].sort();

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
}

interface Partner {
  OrganizationID: number;
  OrganizationName: string;
  OrganizationShortName: string | null;
}

interface ProgramDetail extends ProgramSummary {
  MonitoringProgramDescription: string | null;
  MonitoringApproach: string | null;
  Partners: Partner[];
}

const programPath = (id: number): string => `monitoring-programs/${id}`;

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
});
