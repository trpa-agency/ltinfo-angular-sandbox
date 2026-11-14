// The header's headline tile, the record tile, and the lead paragraph. These run in Node
// against the pure code, with no browser and no map service, on records made here.
import { expect, test } from '@playwright/test';

import { hasHeadline, measureHeadline, trend, TREND_HEIGHT, TREND_WIDTH } from '../src/app/lib/headline';
import type { Measure } from '../src/app/lib/measures';
import { TILE_NA, initialTileState, summaryTiles } from '../src/app/lib/sites';

const occupied: Measure = {
  title: 'Occupied Tahoe yellow cress sites',
  layer: 86,
  x: 'Year',
  y: 'Occupied_Sites',
  yLabel: 'Occupied sites',
  type: 'bar',
  standard: { field: 'Threshold' },
};
const rows = [
  { Year: 2021, Occupied_Sites: 17, Threshold: 26 },
  { Year: 2023, Occupied_Sites: 20, Threshold: 26 },
  { Year: 2022, Occupied_Sites: 8, Threshold: 26 },
];

test.describe('The headline of a measure', () => {
  test('is the latest value, what it measures, when, and the standard', () => {
    expect(measureHeadline(occupied, rows)).toEqual({
      value: '20',
      label: 'Occupied sites',
      sub: '2023. Threshold: 26',
      // In time order, whatever order the service returned the rows in.
      points: [17, 8, 20],
      threshold: 26,
    });
  });

  test('names the first series when the measure has several, and has no standard line without one', () => {
    const clarity: Measure = {
      title: 'Lake clarity',
      x: 'Year',
      y: [
        { field: 'Annual', name: 'Annual' },
        { field: 'Winter', name: 'Winter' },
      ],
      yLabel: 'Secchi depth (m)',
    };
    const headline = measureHeadline(clarity, [
      { Year: 2024, Annual: 19.3, Winter: 22 },
      { Year: 2025, Annual: 21.1, Winter: 24 },
    ]);
    expect(headline).toMatchObject({ value: '21.1', label: 'Secchi depth (m), Annual', sub: '2025', threshold: null });
  });

  test('skips rows with no value, and needs two values for a trend', () => {
    expect(measureHeadline(occupied, [...rows, { Year: 2024, Occupied_Sites: null, Threshold: 26 }])?.sub).toBe('2023. Threshold: 26');
    expect(measureHeadline(occupied, [rows[0]])).toBeNull();
    expect(measureHeadline(occupied, [])).toBeNull();
  });

  test('a ranked, split, picked, or category chart has no single latest value', () => {
    expect(hasHeadline(occupied)).toBe(true);
    expect(hasHeadline({ ...occupied, xType: 'date' })).toBe(true);
    for (const change of [
      { orientation: 'h' },
      { type: 'stacked' },
      { pick: 'Station' },
      { seriesBy: 'Station' },
      { xType: 'category' },
      { xType: 'month' },
      { sort: 'desc' },
      { mirror: 'Male' },
    ] as Partial<Measure>[]) {
      expect(hasHeadline({ ...occupied, ...change }), JSON.stringify(change)).toBe(false);
      expect(measureHeadline({ ...occupied, ...change }, rows)).toBeNull();
    }
  });
});

test.describe('The trend line', () => {
  test('fills the box, ends at the last value, and keeps the standard in view', () => {
    const line = trend([10, 30, 20], 40)!;
    const points = line.line.split(' ').map((pair) => pair.split(',').map(Number));
    expect(points).toHaveLength(3);
    expect(points[0][0]).toBe(2);
    expect(points[2][0]).toBe(TREND_WIDTH - 2);
    // The lowest value sits at the foot of the box, and the standard, the highest, at the top.
    expect(points[0][1]).toBe(TREND_HEIGHT - 2);
    expect(line.standardY).toBe(2);
    expect(line.end).toEqual({ x: points[2][0], y: points[2][1] });
    for (const [x, y] of points) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(TREND_WIDTH);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(TREND_HEIGHT);
    }
  });

  test('a flat record draws a level line, and one value draws nothing', () => {
    const flat = trend([5, 5, 5], null)!;
    expect(new Set(flat.line.split(' ').map((pair) => pair.split(',')[1])).size).toBe(1);
    expect(flat.standardY).toBeNull();
    expect(trend([5], null)).toBeNull();
  });
});

test.describe('The summary tiles', () => {
  const sites = { kind: 'sites' as const, unit: 'site', unitPlural: 'sites', total: 65, mapped: 65, active: null, picked: null, years: [1978, 2025] };

  test('lead with the headline, and fold the record into one span', () => {
    const tiles = summaryTiles({
      ...initialTileState(true, 1),
      sitesState: 'ready',
      sites,
      chartsPending: 0,
      years: [1978, 2025, 2001],
      headline: { value: '20', label: 'Occupied sites', sub: '2023. Threshold: 26', points: [17, 8, 20], threshold: 26 },
    });
    expect(tiles.map((tile) => tile.key)).toEqual(['headline', 'total', 'active', 'record']);
    expect(tiles[0]).toMatchObject({ value: '20', label: 'Occupied sites', points: [17, 8, 20], threshold: 26 });
    expect(tiles[3]).toMatchObject({ label: 'Record', value: '1978 to 2025' });
    // No active flag in the source: the tile reads n/a, and the strip leaves it out.
    expect(tiles[2].value).toBe(TILE_NA);
  });

  test('the site count names the mapped sites only when some are not mapped', () => {
    const state = { ...initialTileState(true, 0), sitesState: 'ready' as const, chartsPending: 0 };
    expect(summaryTiles({ ...state, sites })[0]).toMatchObject({ key: 'total', value: '65', sub: '' });
    expect(summaryTiles({ ...state, sites: { ...sites, mapped: 60 } })[0]).toMatchObject({ value: '65', sub: '60 mapped' });
  });

  test('a record of one year is that year, and no dated records is n/a', () => {
    const state = { ...initialTileState(false, 0), chartsPending: 0 };
    expect(summaryTiles({ ...state, years: [2023] }).at(-1)).toMatchObject({ key: 'record', value: '2023' });
    expect(summaryTiles(state).at(-1)).toMatchObject({ key: 'record', value: TILE_NA });
  });
});
