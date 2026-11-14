/*
 * headline.ts: the one figure a program header leads with, read from the program's first
 * measure: its latest value, what it measures, when, and the standard it is held against,
 * with the record behind it for a small trend line. No DOM types, so it is tested under Node.
 */
import type { Attributes } from './map-service';
import { Measure, fmtValue, measureChartSpec, measureView, xDisplay } from './measures';

export interface Headline {
  /** The latest value, formatted like the chart's axis. */
  value: string;
  /** What the value measures: the chart's value label, with the series name when there are several. */
  label: string;
  /** When the value is from, then the standard: "2023. Threshold: 26". */
  sub: string;
  /** Every value on record in order, for the trend line. */
  points: number[];
  /** The standard on the same scale as the points, or null when the measure has none. */
  threshold: number | null;
}

/** A trend line needs at least this many values. */
export const HEADLINE_MIN_POINTS = 2;

/**
 * True when a measure reads as one record over time: a year or date axis, drawn in time
 * order, with nothing for the reader to choose first. A ranked or mirrored chart, a chart
 * split by a field, and a chart behind a pick have no single latest value.
 */
export function hasHeadline(m: Measure): boolean {
  if (m.xType && m.xType !== 'date') return false;
  if (m.orientation === 'h' || m.type === 'stacked') return false;
  return !m.pick && !m.seriesBy && !m.mirror && !m.sort && !m.limit;
}

/**
 * The headline of a measure and its rows, or null when the measure has no single latest
 * value or its record is too short for a trend. With several y fields the first one leads.
 */
export function measureHeadline(m: Measure, rows: Attributes[]): Headline | null {
  if (!hasHeadline(m)) return null;
  const spec = measureChartSpec(m, measureView(m, rows));
  const series = spec.series[0];
  if (!series) return null;
  const points = series.points.filter((p): p is { x: string | number; y: number } => p.y != null && Number.isFinite(p.y));
  if (points.length < HEADLINE_MIN_POINTS) return null;

  const last = points[points.length - 1];
  const what = m.yLabel || m.yName || m.title;
  const label = spec.series.length > 1 ? `${what}, ${series.name}` : what;
  const when = xDisplay(m, last.x);
  return {
    value: fmtValue(last.y, m.format),
    label,
    sub: spec.threshold ? `${when}. ${spec.threshold.label}` : when,
    points: points.map((p) => p.y),
    threshold: spec.threshold ? spec.threshold.value : null,
  };
}

/** The viewBox a trend line is drawn in, in SVG units. */
export const TREND_WIDTH = 96;
export const TREND_HEIGHT = 32;

export interface Trend {
  /** The polyline's points attribute. */
  line: string;
  /** The last point, for the end dot. */
  end: { x: number; y: number };
  /** The y of the standard line, or null when there is none. */
  standardY: number | null;
}

/**
 * Points for a trend line that fills the viewBox with a one-unit inset, scaled over the
 * values and the standard together so the standard line is always in view.
 */
export function trend(points: readonly number[], threshold: number | null): Trend | null {
  if (points.length < HEADLINE_MIN_POINTS) return null;
  const all = threshold == null ? [...points] : [...points, threshold];
  const min = Math.min(...all);
  const max = Math.max(...all);
  const span = max - min || 1;
  const inset = 2;
  const x = (i: number): number => inset + (i * (TREND_WIDTH - 2 * inset)) / (points.length - 1);
  const y = (v: number): number => TREND_HEIGHT - inset - ((v - min) * (TREND_HEIGHT - 2 * inset)) / span;
  const round = (n: number): number => Math.round(n * 10) / 10;
  const last = points.length - 1;
  return {
    line: points.map((v, i) => `${round(x(i))},${round(y(v))}`).join(' '),
    end: { x: round(x(last)), y: round(y(points[last])) },
    standardY: threshold == null ? null : round(y(threshold)),
  };
}
