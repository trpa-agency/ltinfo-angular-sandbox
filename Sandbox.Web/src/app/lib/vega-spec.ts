/*
 * vega-spec.ts: the library-neutral ChartSpec from measureChartSpec(), plus a
 * small theme, turned into a Vega-Lite spec. Pure: no DOM and no Vega code at
 * run time (the vega-lite import is a type). The component resolves the theme
 * from CSS tokens and hands it in; DEFAULT_VEGA_THEME carries the LT Info
 * values for tests.
 *
 * Shapes covered: multi-series lines with points, grouped bars, stacked bars
 * (shares as percents through format ".0%"), ranked horizontal bars, and a
 * single series with no legend; year, category, month, and date x axes; the
 * zero flag; and the threshold as a dashed rule labelled at its right end.
 *
 * Second encoding beside color: line series rotate point shapes and take dash
 * patterns after the first two. Bars are told apart by position, the legend
 * order, and the tooltip, which names every series at the hovered position.
 */

import type { TopLevelSpec } from 'vega-lite';

import type { AxisKind, ChartSpec, ChartType } from './chart/types';
import { formatDate, formatValue } from './chart/format';

/** What the spec needs from the page's design tokens. Colors are resolved CSS color strings. */
export interface VegaTheme {
  /** Series colors in palette order. The palette wraps when a chart has more series. */
  seriesColors: string[];
  /** Tick labels, legend labels, and the threshold label. */
  textColor: string;
  /** Axis titles and the hover band. */
  titleColor: string;
  /** Gridlines on the value axis. */
  gridColor: string;
  /** The baseline of the category axis. */
  axisColor: string;
  /** The threshold rule. */
  thresholdColor: string;
  /** The surface behind the marks: point outlines and the gaps between stacked segments. */
  surfaceColor: string;
  fontFamily: string;
  /** Tick, legend, and threshold label size in CSS pixels. */
  fontSize: number;
  /** Axis title size in CSS pixels. */
  titleFontSize: number;
}

export interface VegaSpecOptions {
  /** Width of the container in CSS pixels. The whole chart, axes and legend included, fits it. */
  width: number;
  /** Plot height of a vertical chart. 300 by default, 240 under 480 pixels wide. Horizontal charts grow with their bars. */
  height?: number;
}

/** The LT Info theme values, for tests and as the fallback when a token does not resolve. */
export const DEFAULT_VEGA_THEME: VegaTheme = {
  seriesColors: ['#3e72b0', '#c97f0d', '#6b9e11', '#5698ac', '#be4c4c', '#646820', '#3a8291', '#2c5f72'],
  textColor: '#656565',
  titleColor: '#333333',
  gridColor: '#efefef',
  axisColor: '#dcdcdc',
  thresholdColor: '#656565',
  surfaceColor: '#ffffff',
  fontFamily: "'Lexend Deca', system-ui, sans-serif",
  fontSize: 11,
  titleFontSize: 12,
};

/** Vega symbol shapes, rotated per series. Five shapes against eight colors repeat only after 40 series. */
export const POINT_SHAPES = ['circle', 'square', 'triangle-up', 'diamond', 'triangle-down'] as const;
/** Dash patterns for the third series onward; the first two lines are solid. */
export const LINE_DASHES: readonly (readonly number[])[] = [
  [6, 3],
  [2, 3],
  [8, 3, 2, 3],
  [1, 3],
];
/** A line series draws its points only up to this many values, as the SVG chart did. */
export const MAX_POINTS_PER_SERIES = 40;

/** In the "wide" dataset: the field with the display text of the x value. */
export const TOOLTIP_LABEL_FIELD = 'label';
/** In the "wide" dataset: the field with the formatted value of series i (0-based). */
export const tooltipValueField = (seriesIndex: number): string => `v${seriesIndex}`;

export interface SeriesStyle {
  color: string;
  shape: (typeof POINT_SHAPES)[number];
  /** Vega strokeDash; [1, 0] is a solid line. */
  dash: number[];
}

/** Color, point shape, and dash for series i (0-based). */
export function seriesStyle(i: number, theme: VegaTheme): SeriesStyle {
  const colors = theme.seriesColors.length ? theme.seriesColors : DEFAULT_VEGA_THEME.seriesColors;
  return {
    color: colors[i % colors.length],
    shape: POINT_SHAPES[i % POINT_SHAPES.length],
    dash: i < 2 ? [1, 0] : [...LINE_DASHES[(i - 2) % LINE_DASHES.length]],
  };
}

/** Milliseconds (UTC) for an ISO date, or NaN. */
export function isoToMs(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : Number.NaN;
}

/** Estimated width of a label in pixels. Lexend Deca is a wide face, about 0.6 em a glyph. */
function textWidth(s: string, fontSize: number): number {
  return s.length * fontSize * 0.6;
}

/** Names made unique by a numbered suffix, so a name can key a scale domain and a tooltip row. */
function uniqueNames(names: string[], reserved: string[] = []): string[] {
  const seen = new Set<string>(reserved);
  return names.map((raw) => {
    const base = raw === '' ? 'Value' : raw;
    let name = base;
    for (let n = 2; seen.has(name); n += 1) name = `${base} (${n})`;
    seen.add(name);
    return name;
  });
}

interface Shape {
  type: ChartType;
  isBar: boolean;
  stacked: boolean;
  horizontal: boolean;
  kind: AxisKind;
}

function shapeOf(spec: ChartSpec): Shape {
  const type: ChartType = spec.type ?? 'line';
  const isBar = type === 'bar' || type === 'stacked';
  const horizontal = !!spec.horizontal;
  return { type, isBar, stacked: type === 'stacked', horizontal, kind: horizontal || isBar ? 'band' : spec.xKind };
}

/** Category keys in drawing order: spec.categories on a band axis, else the keys in the data (sorted when continuous). */
function categoryKeys(spec: ChartSpec, kind: AxisKind): string[] {
  if (spec.categories && kind === 'band') return spec.categories.slice();
  const seen = new Set<string>();
  for (const s of spec.series) for (const p of s.points) seen.add(String(p.x));
  const keys = [...seen];
  if (kind === 'linear') keys.sort((a, b) => Number(a) - Number(b));
  else if (kind === 'time') keys.sort();
  return keys;
}

/** Display text for a category key: its given name, a date written out, or the key itself. */
function keyLabel(spec: ChartSpec, kind: AxisKind, key: string): string {
  const named = spec.categoryLabels?.[key];
  // measureChartSpec names every key, a date by its own ISO text; that is still a date to write out.
  if (kind === 'time') return named && named !== key ? named : formatDate(key);
  return named ?? key;
}

/**
 * One sentence for assistive technology: the series, the span of the category
 * axis, and the threshold. The table view carries the values.
 */
export function chartDescription(spec: ChartSpec): string {
  const { horizontal, kind } = shapeOf(spec);
  const keys = categoryKeys(spec, kind);
  const labels = keys.map((k) => keyLabel(spec, kind, k));
  const n = spec.series.length;
  const names = spec.series.map((s) => s.name);
  const shown = names.slice(0, 4).join(', ') + (n > 4 ? `, and ${n - 4} more` : '');
  const first = labels[0] ?? '';
  const last = labels[labels.length - 1] ?? '';
  const range = horizontal
    ? `${labels.length} bars ranked from ${first} to ${last}`
    : `${spec.xLabel || 'Position'} from ${first} to ${last}`;
  const threshold = spec.threshold && !horizontal ? ` ${spec.threshold.label} drawn as a dashed line.` : '';
  return `${n} series (${shown}). ${range}.${threshold}`;
}

type Json = Record<string, unknown>;

/**
 * The Vega-Lite spec for a chart at a given container width. Two datasets: "long"
 * (one row per series and position: x, y, s for the series name, o for its order)
 * feeds the marks, and "wide" (one row per position: x, label, v0 to vN as formatted
 * text) feeds the hover layer, so a tooltip shows the x value and every series value.
 */
export function vegaLiteSpec(spec: ChartSpec, theme: VegaTheme, options: VegaSpecOptions): TopLevelSpec {
  const { isBar, stacked, horizontal, kind } = shapeOf(spec);
  const width = Math.max(200, Math.round(options.width));
  const compact = width < 480;
  const plotHeight = options.height ?? (compact ? 240 : 300);
  const fontSize = theme.fontSize;
  const xTitle = spec.xLabel || (horizontal ? 'Category' : 'Position');
  const names = uniqueNames(
    spec.series.map((s) => s.name),
    [xTitle],
  );
  const multi = names.length > 1;
  const styles = names.map((_, i) => seriesStyle(i, theme));

  // Positions along the category axis, and what each is called.
  const keys = categoryKeys(spec, kind);
  const labels = keys.map((k) => keyLabel(spec, kind, k));
  const labelsUnique = new Set(labels).size === labels.length;
  const position = new Map<string, string | number>();
  keys.forEach((k, i) => {
    if (kind === 'linear') position.set(k, Number(k));
    else if (kind === 'time') position.set(k, isoToMs(k));
    else position.set(k, labelsUnique ? labels[i] : k);
  });
  const domain = keys.map((k) => position.get(k) as string | number);

  // Room the plot has once the value labels (or, on a horizontal chart, the category
  // labels) are set aside. An estimate: Vega measures the real text when it draws.
  const longestLabel = labels.reduce((w, s) => Math.max(w, textWidth(s, fontSize)), 0);
  const categoryLimit = Math.floor(width * 0.4);
  // A horizontal chart with no room for a column of names beside its bars (a phone, or
  // names longer than the column) puts each name on its own line above its bar, and the
  // bars take the full width. Grouped bars keep the column.
  const labelsAbove = horizontal && !(multi && !stacked) && (compact || longestLabel > categoryLimit);
  const axisRoom = !horizontal ? 56 : labelsAbove ? 8 : Math.min(categoryLimit, Math.ceil(longestLabel)) + 10;
  const plotWidth = Math.max(120, width - axisRoom);

  // One value per series and position (the last row wins, as in the SVG chart).
  const valueAt: Map<string, number | null>[] = spec.series.map((s) => {
    const m = new Map<string, number | null>();
    for (const p of s.points) m.set(String(p.x), p.y != null && Number.isFinite(p.y) ? p.y : null);
    return m;
  });

  const long: Json[] = [];
  const wide: Json[] = [];
  const perSeries: Json[][] = [];
  let maxPoints = 0;
  let dataMax = -Infinity;
  let stackMax = -Infinity;
  valueAt.forEach((m, i) => {
    const finite: Json[] = [];
    for (const k of keys) {
      if (!m.has(k)) continue;
      const y = m.get(k) ?? null;
      if (y == null && isBar) continue;
      const row: Json = { x: position.get(k), y, s: names[i], o: i };
      if (y != null) {
        finite.push(row);
        dataMax = Math.max(dataMax, y);
      }
      long.push(row);
    }
    perSeries.push(finite);
    maxPoints = Math.max(maxPoints, finite.length);
  });
  // A dense line (a daily record) cannot carry a point on every value or a readable dash.
  // It is drawn solid, with its shape on a few evenly spaced values, staggered by series.
  const dense = !isBar && maxPoints > MAX_POINTS_PER_SERIES;
  if (dense) {
    const perLine = Math.max(4, Math.min(10, Math.floor(width / 90)));
    perSeries.forEach((rows, i) => {
      const stride = Math.max(1, Math.ceil(rows.length / perLine));
      const phase = Math.floor(((i + 0.5) * stride) / perSeries.length);
      for (let j = phase; j < rows.length; j += stride) rows[j]['m'] = 1;
    });
  }
  for (const k of keys) {
    const row: Json = { x: position.get(k), [TOOLTIP_LABEL_FIELD]: keyLabel(spec, kind, k) };
    let total = 0;
    valueAt.forEach((m, i) => {
      const y = m.get(k);
      if (y == null) return;
      row[tooltipValueField(i)] = formatValue(y, spec.format);
      if (y > 0) total += y;
    });
    stackMax = Math.max(stackMax, total);
    wide.push(row);
  }

  // Scales shared by every layer.
  const colorScale = { domain: names, range: styles.map((s) => s.color) };
  const seriesLegend = multi ? legend(names, plotWidth, theme, !isBar) : null;
  const color: Json = multi
    ? { field: 's', type: 'nominal', scale: colorScale, legend: seriesLegend }
    : { value: styles[0]?.color ?? DEFAULT_VEGA_THEME.seriesColors[0] };

  // Value axis.
  const percent = spec.format === '.0%';
  const valueScale: Json = { zero: isBar ? true : spec.zero !== false, nice: true };
  // Shares that add up to 100 percent keep the axis at 100, not the next nice step.
  if (percent && stacked && stackMax > 0 && stackMax <= 1.0005) {
    valueScale['domain'] = [0, 1];
    valueScale['nice'] = false;
  }
  const value: Json = {
    field: 'y',
    type: 'quantitative',
    scale: valueScale,
    axis: {
      title: spec.yLabel || null,
      grid: true,
      domain: false,
      ticks: false,
      labelPadding: 6,
      tickCount: horizontal ? Math.max(2, Math.min(6, Math.floor(plotWidth / 80))) : 5,
      ...(percent ? { format: '.0%' } : {}),
    },
    ...(isBar ? { stack: stacked ? 'zero' : null } : {}),
  };

  // Category axis.
  const category = categoryEncoding({
    spec,
    kind,
    isBar,
    horizontal,
    domain,
    labels,
    longestLabel,
    categoryLimit,
    labelsAbove,
    plotWidth,
  });
  const catChannel = horizontal ? 'y' : 'x';
  const valChannel = horizontal ? 'x' : 'y';
  const offsetChannel = horizontal ? 'yOffset' : 'xOffset';
  const sizeProp = horizontal ? 'height' : 'width';

  const layers: Json[] = [];
  if (isBar) {
    const grouped = multi && !stacked;
    const inner = 0.08;
    const encoding: Json = { [catChannel]: category, [valChannel]: value, color };
    if (grouped) {
      // A group fills 76 percent of its band; the rest is the gap between groups.
      encoding[offsetChannel] = {
        field: 's',
        type: 'nominal',
        scale: { domain: names, paddingInner: inner, paddingOuter: (names.length - inner) * 0.158 },
      };
    }
    if (stacked && multi) encoding['order'] = { field: 'o', type: 'quantitative' };
    layers.push({
      mark: {
        type: 'bar',
        ...(labelsAbove ? { height: 12, yOffset: 8 } : grouped ? {} : { [sizeProp]: { band: 0.72 } }),
        ...(stacked && multi ? { stroke: theme.surfaceColor, strokeWidth: 1 } : {}),
      },
      encoding,
    });
    if (labelsAbove) {
      layers.push({
        data: { name: 'wide' },
        mark: {
          type: 'text',
          x: 0,
          dy: -2,
          align: 'left',
          baseline: 'bottom',
          limit: plotWidth,
          color: theme.textColor,
          fontSize,
        },
        encoding: { y: category, text: { field: TOOLTIP_LABEL_FIELD, type: 'nominal' } },
      });
    }
  } else {
    const line: Json = { [catChannel]: category, [valChannel]: value, color };
    if (multi && !dense) {
      // The legend shows each series as its colored shape; the dash is read on the line itself.
      // Keyed on the series order, not its name, so this scale stays out of the shared legend.
      line['strokeDash'] = {
        field: 'o',
        type: 'nominal',
        scale: { domain: names.map((_, i) => i), range: styles.map((s) => s.dash) },
        legend: null,
      };
    }
    layers.push({
      mark: { type: 'line', strokeWidth: dense ? 1.25 : 2, strokeJoin: 'round', invalid: 'break-paths-show-path-domains' },
      encoding: line,
    });
    if (!dense || multi) {
      const point: Json = { [catChannel]: category, [valChannel]: value, color };
      if (multi) {
        point['shape'] = {
          field: 's',
          type: 'nominal',
          scale: { domain: names, range: styles.map((s) => s.shape) },
          legend: seriesLegend,
        };
      }
      layers.push({
        ...(dense ? { transform: [{ filter: 'datum.m === 1' }] } : {}),
        mark: { type: 'point', filled: true, opacity: 1, size: dense ? 64 : 46, stroke: theme.surfaceColor, strokeWidth: 1 },
        encoding: point,
      });
    }
  }

  // Threshold: a dashed rule across the plot, labelled at its right end. Vertical charts only.
  if (spec.threshold && !horizontal && Number.isFinite(spec.threshold.value)) {
    const t = spec.threshold;
    const atTop = !(dataMax > t.value);
    const y = { datum: t.value, type: 'quantitative' };
    layers.push({
      data: { values: [{}] },
      mark: { type: 'rule', color: theme.thresholdColor, strokeWidth: 1.5, strokeDash: [6, 4] },
      encoding: { y },
    });
    layers.push({
      data: { values: [{}] },
      mark: {
        type: 'text',
        text: t.label,
        x: { expr: 'width' },
        align: 'right',
        // Above the line, or below it when nothing is drawn higher than the threshold.
        baseline: atTop ? 'top' : 'bottom',
        dy: atTop ? 5 : -5,
        color: theme.textColor,
        fontSize,
        fontWeight: 500,
      },
      encoding: { y },
    });
  }

  // Hover: one target per position, with the x value and every series value.
  const tooltip = [
    { field: TOOLTIP_LABEL_FIELD, type: 'nominal', title: xTitle },
    ...names.map((name, i) => ({ field: tooltipValueField(i), type: 'nominal', title: name })),
  ];
  if (isBar) {
    layers.push({
      data: { name: 'wide' },
      mark: { type: 'bar', fill: theme.titleColor },
      encoding: {
        [catChannel]: category,
        fillOpacity: { condition: { param: 'hover', empty: false, value: 0.07 }, value: 0 },
        tooltip,
      },
      params: [{ name: 'hover', select: { type: 'point', fields: ['x'], on: 'pointerover', clear: 'pointerout' } }],
    });
  } else {
    layers.push({
      transform: [{ filter: { param: 'hover', empty: false } }],
      mark: { type: 'point', filled: true, opacity: 1, size: 80, stroke: theme.surfaceColor, strokeWidth: 1.5 },
      encoding: {
        [catChannel]: category,
        [valChannel]: { field: 'y', type: 'quantitative' },
        color,
      },
    });
    layers.push({
      data: { name: 'wide' },
      mark: { type: 'rule', color: theme.textColor, strokeWidth: 1 },
      encoding: {
        [catChannel]: category,
        opacity: { condition: { param: 'hover', empty: false, value: 0.6 }, value: 0 },
        tooltip,
      },
      params: [
        { name: 'hover', select: { type: 'point', fields: ['x'], nearest: true, on: 'pointerover', clear: 'pointerout' } },
      ],
    });
  }

  // Horizontal charts grow with their bars: a taller step for a group of bars, and for a name above its bar.
  const step = labelsAbove ? 38 : Math.max(24, multi && !stacked ? names.length * 12 + 8 : 24);
  const out: Json = {
    $schema: 'https://vega.github.io/schema/vega-lite/v6.json',
    description: `${spec.title}. ${chartDescription(spec)}`,
    width,
    height: horizontal ? Math.max(1, keys.length) * step : plotHeight,
    autosize: { type: 'fit-x', contains: 'padding' },
    padding: { left: 0, right: 4, top: 6, bottom: 0 },
    background: 'transparent',
    datasets: { long, wide },
    data: { name: 'long' },
    layer: layers,
    config: config(theme),
  };
  return out as unknown as TopLevelSpec;
}

/** The category axis encoding: years on a linear scale, dates on a UTC time scale, everything else in bands. */
function categoryEncoding(a: {
  spec: ChartSpec;
  kind: AxisKind;
  isBar: boolean;
  horizontal: boolean;
  domain: (string | number)[];
  labels: string[];
  /** Estimated width of the longest category label, in pixels. */
  longestLabel: number;
  /** The most room a horizontal chart gives its category labels. */
  categoryLimit: number;
  /** The names are drawn above the bars, so the axis shows none. */
  labelsAbove: boolean;
  plotWidth: number;
}): Json {
  const { spec, kind, isBar, horizontal, domain, labels, longestLabel, categoryLimit, labelsAbove, plotWidth } = a;
  const base = { grid: false, ticks: false, labelPadding: 6, title: horizontal ? null : spec.xLabel || null };

  if (kind === 'linear') {
    const nums = (domain as number[]).filter((n) => Number.isFinite(n));
    const lo = nums.length ? Math.min(...nums) : 0;
    const hi = nums.length ? Math.max(...nums) : 1;
    return {
      field: 'x',
      type: 'quantitative',
      scale: { zero: false, nice: false, padding: 10, ...(lo === hi ? { domain: [lo - 1, hi + 1] } : {}) },
      axis: {
        ...base,
        format: 'd',
        tickMinStep: 1,
        labelOverlap: true,
        // With only a few years, mark just those years so no tick repeats one.
        ...(nums.length < 6 ? { values: nums } : { tickCount: Math.max(2, Math.floor(plotWidth / 70)) }),
      },
    };
  }

  if (kind === 'time') {
    return {
      field: 'x',
      type: 'temporal',
      scale: { type: 'utc', nice: false, padding: 10 },
      axis: { ...base, labelOverlap: true, tickCount: Math.max(2, Math.floor(plotWidth / 75)) },
    };
  }

  // Bands. Bars fill their band through the mark, so the hover target can cover the whole band.
  const scale = isBar ? { domain, paddingInner: 0, paddingOuter: 0 } : { domain, type: 'point', padding: 0.5 };
  if (horizontal) {
    const axis = labelsAbove ? { ...base, labels: false, domain: false } : { ...base, labelLimit: categoryLimit };
    return { field: 'x', type: 'ordinal', scale, axis };
  }
  const stepWidth = plotWidth / Math.max(1, labels.length);
  const fits = longestLabel + 8 <= stepWidth;
  // Years, periods, and month names stay level and thin out; longer text tilts.
  const short = labels.every((s) => s.length <= 9);
  const axis: Json =
    fits || short
      ? { ...base, labelAngle: 0, labelOverlap: 'parity', labelSeparation: 4 }
      : { ...base, labelAngle: -35, labelAlign: 'right', labelBaseline: 'middle', labelLimit: 120, labelOverlap: 'greedy' };
  return { field: 'x', type: 'ordinal', scale, axis };
}

/**
 * The series legend: under the plot and as wide as it, in as many columns as fit, so it
 * wraps on a phone. labelLimit keeps the widest row inside the width it was given.
 */
function legend(names: string[], width: number, theme: VegaTheme, lines: boolean): Json {
  const symbol = lines ? 30 : 16;
  const gap = 16;
  const longest = names.reduce((w, s) => Math.max(w, textWidth(s, theme.fontSize)), 0);
  const item = Math.min(longest, 220) + symbol + gap;
  const columns = Math.max(1, Math.min(names.length, Math.floor(width / item)));
  return {
    title: null,
    orient: 'bottom',
    direction: 'horizontal',
    columns,
    columnPadding: gap,
    rowPadding: 6,
    offset: 14,
    labelLimit: Math.max(60, Math.floor(width / columns) - symbol - gap),
    ...(lines ? { symbolSize: 50, symbolStrokeWidth: 2 } : { symbolType: 'square', symbolSize: 110 }),
  };
}

function config(theme: VegaTheme): Json {
  return {
    // The wrapper element carries the accessible name and description; the table view carries the values.
    aria: false,
    font: theme.fontFamily,
    view: { stroke: null },
    axis: {
      labelColor: theme.textColor,
      labelFontSize: theme.fontSize,
      titleColor: theme.titleColor,
      titleFontSize: theme.titleFontSize,
      titleFontWeight: 500,
      titlePadding: 10,
      gridColor: theme.gridColor,
      domainColor: theme.axisColor,
      tickColor: theme.axisColor,
    },
    legend: {
      labelColor: theme.textColor,
      labelFontSize: theme.fontSize,
    },
  };
}
