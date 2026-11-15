// The filters a program page shows once above its map and charts: what a choice adds to a
// panel's where, and which panels it reaches. These run in Node against the pure code.
import { expect, test } from '@playwright/test';

import type { PageFilter } from '../src/app/lib/page-filters';
import { activeFilterCount, applyFilters, filterClause } from '../src/app/lib/page-filters';

const SERVICE = 'https://maps.example/Transportation/MapServer';

const byType: PageFilter = {
  field: 'CLASS',
  label: 'Type',
  service: SERVICE,
  layer: 3,
  style: 'buttons',
  options: [
    { label: 'Shared-use path', values: ['1'] },
    { label: 'Sidewalk', values: ['PED'] },
  ],
};

const byAgency: PageFilter = {
  field: 'MAINT_JURS',
  label: 'Maintained by',
  service: SERVICE,
  layer: 3,
  options: [
    { label: 'Placer County', values: ['PLACER COUNTY', 'Placer County'] },
    { label: "Harrah's", values: ["HARRAH'S"] },
  ],
};

test.describe('What a choice adds to a where clause', () => {
  test('one value is an equality; several spellings of one option are a list', () => {
    expect(filterClause(byType, 'Sidewalk')).toBe("CLASS = 'PED'");
    expect(filterClause(byAgency, 'Placer County')).toBe("MAINT_JURS IN ('PLACER COUNTY', 'Placer County')");
  });

  test('no choice, or a choice the filter does not list, adds nothing', () => {
    expect(filterClause(byType, undefined)).toBeNull();
    expect(filterClause(byType, '')).toBeNull();
    expect(filterClause(byType, 'Monorail')).toBeNull();
  });

  test('a quote in a value is doubled, so the clause stays one string', () => {
    expect(filterClause(byAgency, "Harrah's")).toBe("MAINT_JURS = 'HARRAH''S'");
  });
});

test.describe('Which panels a filter reaches', () => {
  const filters = [byType, byAgency];

  test('a panel on the filter layer gets every chosen filter, after its own where kept whole', () => {
    const measure = { title: 'Miles built', service: SERVICE, layer: 3, where: "YEAR LIKE '20%' OR YEAR LIKE ' 20%'" };
    const filtered = applyFilters(measure, filters, { CLASS: 'Sidewalk', MAINT_JURS: 'Placer County' });
    expect(filtered.where).toBe("(YEAR LIKE '20%' OR YEAR LIKE ' 20%') AND CLASS = 'PED' AND MAINT_JURS IN ('PLACER COUNTY', 'Placer County')");
    expect(filtered.title).toBe('Miles built');
    // The settings object itself is not changed.
    expect(measure.where).toBe("YEAR LIKE '20%' OR YEAR LIKE ' 20%'");
  });

  test('a panel with no where of its own gets the clause alone', () => {
    expect(applyFilters({ service: SERVICE, layer: 3 }, filters, { CLASS: 'Shared-use path' }).where).toBe("CLASS = '1'");
    expect(applyFilters({ service: SERVICE, layer: '3', where: '1=1' }, filters, { CLASS: 'Shared-use path' }).where).toBe("CLASS = '1'");
  });

  test('a panel on another layer or service, or one read from a file, comes back as the same object', () => {
    const state = { CLASS: 'Sidewalk' };
    const proposed = { service: SERVICE, layer: 4 };
    const elsewhere = { layer: 3 };
    const file = { json: 'data/file.json' } as { json: string; layer?: number };
    expect(applyFilters(proposed, filters, state)).toBe(proposed);
    expect(applyFilters(elsewhere, filters, state)).toBe(elsewhere);
    expect(applyFilters(file, filters, state)).toBe(file);
  });

  test('with nothing chosen every panel comes back as the same object, so none loads again', () => {
    const measure = { service: SERVICE, layer: 3, where: 'MILES > 0' };
    expect(applyFilters(measure, filters, {})).toBe(measure);
    expect(activeFilterCount(filters, {})).toBe(0);
    expect(activeFilterCount(filters, { CLASS: 'Sidewalk', MAINT_JURS: '' })).toBe(1);
  });
});
