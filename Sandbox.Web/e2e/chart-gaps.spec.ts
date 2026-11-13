// The "No Data" block: which holes in a record count as a gap, and what the chart draws for
// one. These run in Node against the pure chart code, with no browser and no map service, so
// the rule is tested on records made here rather than on whatever a service holds today.
import { expect, test } from '@playwright/test';

import type { ChartSpec } from '../src/app/lib/chart/types';
import { DEFAULT_VEGA_THEME, GAP_LABEL, chartDescription, chartGaps, vegaLiteSpec } from '../src/app/lib/vega-spec';

const DAY = 86_400_000;
const iso = (ms: number): string => new Date(ms).toISOString().slice(0, 10);

/** A daily record from March 1, 2025: one point a day for each run of [first day, last day]. */
function daily(runs: [number, number][], overrides: Partial<ChartSpec> = {}): ChartSpec {
  const start = Date.UTC(2025, 2, 1);
  const points = runs.flatMap(([from, to]) =>
    Array.from({ length: to - from + 1 }, (_, i) => ({ x: iso(start + (from + i) * DAY), y: 100 + i })),
  );
  return { title: 'Daily count', type: 'line', xKind: 'time', xLabel: 'Date', series: [{ name: 'Count', points }], ...overrides };
}

/** A yearly record: one point for each year listed. */
function yearly(years: number[], overrides: Partial<ChartSpec> = {}): ChartSpec {
  return {
    title: 'Yearly count',
    type: 'line',
    xKind: 'linear',
    xLabel: 'Year',
    series: [{ name: 'Count', points: years.map((x) => ({ x, y: 10 })) }],
    ...overrides,
  };
}

type Json = Record<string, unknown>;
const layersOf = (spec: ChartSpec): Json[] => (vegaLiteSpec(spec, DEFAULT_VEGA_THEME, { width: 800 }) as unknown as { layer: Json[] }).layer;
const datasetsOf = (spec: ChartSpec): { long: Json[]; wide: Json[] } =>
  (vegaLiteSpec(spec, DEFAULT_VEGA_THEME, { width: 800 }) as unknown as { datasets: { long: Json[]; wide: Json[] } }).datasets;
const markOf = (layer: Json): Json => layer['mark'] as Json;

test.describe('Which holes in a record are gaps', () => {
  test('two months missing from a daily record is a gap; five days is not', () => {
    // Days 0 to 40, then 100 to 180: sixty days with nothing between.
    const holed = daily([
      [0, 40],
      [100, 180],
    ]);
    expect(chartGaps(holed)).toEqual([{ from: '2025-04-10', to: '2025-06-09', share: 60 / 180 }]);

    // Days 0 to 90, then 96 to 180: a short outage is under four percent of the record.
    expect(
      chartGaps(
        daily([
          [0, 90],
          [96, 180],
        ]),
      ),
    ).toEqual([]);
  });

  test('a record with no hole, or too few values to have a usual step, has none', () => {
    expect(chartGaps(daily([[0, 180]]))).toEqual([]);
    expect(
      chartGaps(
        daily([
          [0, 1],
          [100, 101],
        ]),
      ),
    ).toEqual([]);
  });

  test('a year axis marks gaps only when asked, since years are often sparse by design', () => {
    const years = [2010, 2011, 2012, 2013, 2014, 2015, 2023, 2024];
    expect(chartGaps(yearly(years))).toEqual([]);
    expect(chartGaps(yearly(years, { gaps: true }))).toEqual([{ from: '2015', to: '2023', share: 8 / 14 }]);
    // A census every ten years has no gap even when asked: ten years is its usual step.
    expect(chartGaps(yearly([1980, 1990, 2000, 2010, 2020], { gaps: true }))).toEqual([]);
  });

  test('gaps can be turned off, and text categories and ranked bars never have them', () => {
    const runs: [number, number][] = [
      [0, 40],
      [100, 180],
    ];
    expect(chartGaps(daily(runs, { gaps: false }))).toEqual([]);
    expect(chartGaps(daily(runs, { xKind: 'band' }))).toEqual([]);
    expect(chartGaps(daily(runs, { type: 'bar', horizontal: true }))).toEqual([]);
  });

  test('a value that is null is not data: a gap is measured between real values', () => {
    const spec = daily([
      [0, 40],
      [100, 180],
    ]);
    spec.series[0].points.push({ x: '2025-05-01', y: null });
    expect(chartGaps(spec)).toHaveLength(1);
  });
});

test.describe('What a chart draws for a gap', () => {
  const holed = daily([
    [0, 40],
    [100, 180],
  ]);

  test('a line chart gets a gray block with the words on it, and the line stops at the gap', () => {
    const layers = layersOf(holed);
    const block = layers.find((layer) => markOf(layer)['type'] === 'rect')!;
    expect(markOf(block)['fill']).toBe(DEFAULT_VEGA_THEME.gapColor);
    expect((block['data'] as { values: Json[] }).values).toEqual([
      expect.objectContaining({ x: Date.UTC(2025, 3, 10), x2: Date.UTC(2025, 5, 9) }),
    ]);
    const words = layers.find((layer) => markOf(layer)['type'] === 'text' && markOf(layer)['text'] === GAP_LABEL)!;
    // A third of an 800 pixel chart has room for the words to run level.
    expect(markOf(words)['angle']).toBe(0);
    // The block and its words sit under the line.
    const line = layers.findIndex((layer) => markOf(layer)['type'] === 'line');
    expect(layers.indexOf(block)).toBeLessThan(line);
    expect(layers.indexOf(words)).toBeLessThan(line);

    // One row with no value inside the gap breaks the line there.
    const breaks = datasetsOf(holed).long.filter((row) => row['y'] === null);
    expect(breaks).toEqual([{ x: (Date.UTC(2025, 3, 10) + Date.UTC(2025, 5, 9)) / 2, y: null, s: 'Count', o: 0 }]);
  });

  test('a narrow gap turns the words to run up the block', () => {
    // Days 0 to 150, then 160 to 180: ten days is 5.6 percent of the record, about 40 pixels.
    const narrow = daily([
      [0, 150],
      [160, 180],
    ]);
    expect(chartGaps(narrow)).toHaveLength(1);
    const words = layersOf(narrow).find((layer) => markOf(layer)['type'] === 'text' && markOf(layer)['text'] === GAP_LABEL)!;
    expect(markOf(words)['angle']).toBe(270);
  });

  test('a bar chart gets one placeholder band for the gap, between the bars on either side', () => {
    const bars = { ...holed, type: 'bar' as const };
    const { wide } = datasetsOf(bars);
    const at = wide.findIndex((row) => row['label'] === GAP_LABEL);
    // 41 days of bars, the gap, then 81 days of bars.
    expect(wide).toHaveLength(41 + 1 + 81);
    expect(at).toBe(41);
    const layers = layersOf(bars);
    const band = layers.find((layer) => markOf(layer)['type'] === 'bar' && markOf(layer)['fill'] === DEFAULT_VEGA_THEME.gapColor)!;
    expect((band['data'] as { values: Json[] }).values).toEqual([{ x: wide[at]['x'] }]);
    const words = layers.find((layer) => markOf(layer)['type'] === 'text' && markOf(layer)['text'] === GAP_LABEL)!;
    expect(markOf(words)['angle']).toBe(270);
  });

  test('a chart with no gap draws nothing for one', () => {
    const layers = layersOf(daily([[0, 180]]));
    expect(layers.some((layer) => markOf(layer)['type'] === 'rect')).toBe(false);
    expect(layers.some((layer) => markOf(layer)['text'] === GAP_LABEL)).toBe(false);
    expect(datasetsOf(daily([[0, 180]])).long.every((row) => row['y'] !== null)).toBe(true);
  });

  test('the description read to screen readers names the gap', () => {
    expect(chartDescription(holed)).toContain('No data between April 10, 2025 and June 9, 2025.');
    expect(chartDescription(daily([[0, 180]]))).not.toContain('No data');
  });
});
