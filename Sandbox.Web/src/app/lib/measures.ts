/*
 * measures.ts: a programs.json measure config plus rows from the TRPA map
 * service, turned into a chart spec, table columns, and pick choices.
 *
 * Ported function by function from templates/program-dashboard.html in the
 * reference repo (fmtValue, measureYs, queryMeasure, measureView,
 * measureSeries, measureColumns, the pick default, and the span rule). Every
 * key in templates/README.md is supported. Pure: no DOM.
 */

import type { Attributes, ServiceOptions } from './map-service';
import { normalizeDate, queryFeatures, queryStatistics, unpivot } from './map-service';
import { parseCsv } from './csv';
import type { AxisKind, ChartSpec, ChartType } from './chart/types';
import { MONTHS, formatMonthYear, formatValue, isoParts } from './chart/format';
import { plural, yearOf } from './sites';

export { MONTHS };

export interface MeasureY {
  field: string;
  name?: string;
}

export interface MeasureStandard {
  /** Field that carries the threshold on each row; the first finite value is used. */
  field?: string;
  /** Fixed threshold value, used instead of a field. */
  value?: number;
  /** Label for the line; "Threshold" when omitted. */
  label?: string;
}

export type MeasureSpan = 'span-12' | 'span-6';

/** One entry of a program's measures list in programs.json. Keys as documented in templates/README.md. */
export interface Measure {
  title: string;
  sub?: string;
  /** Layer or table ID in the service. Omitted when csv is set. */
  layer?: number | string;
  /** The map service the layer is in; the LTInfo_Monitoring service when omitted. */
  service?: string;
  /**
   * A CSV file to read instead of a map service layer, for numbers no service publishes yet.
   * Its rows are charted as they are: where and stat do not apply.
   */
  csv?: string;
  /**
   * A JSON file to read instead of a map service layer: an array of rows, or an object whose
   * rows key holds them. Charted as they are, like csv.
   */
  json?: string;
  /** Where a csv or json file's numbers were published, for the source line under the chart. */
  sourceHref?: string;
  sourceLabel?: string;
  where?: string;
  x: string;
  xLabel?: string;
  /** Omit for years, "category" for text such as 2016-2019, "date" for dates, "month" for month numbers. */
  xType?: 'category' | 'date' | 'month';
  /** One field, or several { field, name } series. */
  y: string | MeasureY[];
  yName?: string;
  yLabel?: string;
  /** ".0%" for shares, ".1%" for shares small enough to need a decimal. */
  format?: string;
  /** Computed on the server, grouped by x, seriesBy, and pick. */
  stat?: 'sum' | 'count' | 'avg';
  seriesBy?: string;
  seriesLabel?: string;
  seriesNames?: Record<string, string>;
  /**
   * A population pyramid: the series (seriesBy value or y field) drawn to the left of zero, as
   * horizontal stacked bars. Its values stay positive in the table and the CSV.
   */
  mirror?: string;
  /** The order of category x values (stages, classes); values not listed follow, sorted. */
  xOrder?: string[];
  /** The order of the seriesBy values (stages, classes); values not listed follow, sorted. */
  seriesOrder?: string[];
  /**
   * A fixed color per series, keyed by seriesBy value or y field, as a CSS color or a palette
   * token such as var(--mon-greens-3). Series without one take the theme's order.
   */
  seriesColors?: Record<string, string>;
  seriesPrefix?: string;
  pick?: string;
  pickLabel?: string;
  pickDefault?: string;
  type?: ChartType;
  orientation?: 'v' | 'h';
  sort?: 'asc' | 'desc';
  limit?: number;
  standard?: MeasureStandard;
  /** false lets the value axis start above zero. */
  zero?: boolean;
  /**
   * Draws a gray "No Data" block over a long stretch with no values. On by default on a date
   * axis; true turns it on for a year axis, and false turns it off.
   */
  gaps?: boolean;
  span?: MeasureSpan;
  xNames?: Record<string, string>;
  unpivot?: { prefix: string };
  /**
   * A second field joined to x with a space, where one field does not name the category: Year
   * and Season make "2021 Fall".
   */
  xWith?: string;
  /** "month" when a date axis holds one value a month: labeled "July 2017", not "July 1, 2017". */
  dateStep?: 'month';
  /**
   * A date field to read the year and the month from. Each row gains <field>_year and
   * <field>_month, so a table with one date column can be charted by year, or by month of the
   * year with a series for each year.
   */
  dateParts?: string;
  /**
   * "sum" adds up, in the browser, the rows that share x, series, and pick. For a grouping the
   * server cannot do, such as by the year read out of a text month; stat is the server's.
   */
  combine?: 'sum';
  /**
   * Charts each value as its share of the total across the series at the same x (and pick),
   * for a table that holds counts where the reader wants shares. Needs seriesBy and one y. The
   * count stays in the table, headed by yName.
   */
  share?: boolean;
}

/** The field a measure's shares are put in. */
export const SHARE_FIELD = 'share';

export interface MeasureSeries {
  name: string;
  /** The seriesBy value, or the y field, the series stands for. */
  key: string;
  field: string;
  rows: Attributes[];
}

export interface MeasureColumn {
  field: string;
  headerName: string;
  /** Right-aligned, formatted with fmtValue. */
  num?: boolean;
  /** The column's own number format; the measure's when omitted. */
  format?: string;
}

export const ERROR_STATE = {
  title: 'Data could not be loaded',
  description: 'The TRPA map service did not respond. Reload the page to try again.',
};

/** A value for tables and labels. ".0%" shows shares as percents, anything else a plain number. */
export const fmtValue = formatValue;

const toNumber = (v: unknown): number | null => {
  if (v == null || v === '') return null;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};

/** The y fields a measure reads: the server statistic, the listed fields, or the one y field. */
function sourceYs(m: Measure): MeasureY[] {
  // Several y fields with a stat: each is computed into a column of its own name.
  if (Array.isArray(m.y)) return m.y;
  if (m.stat) return [{ field: 'value', name: m.yName || m.yLabel }];
  return [{ field: m.y, name: m.yName || m.yLabel }];
}

/** The y fields a measure charts: the ones it reads, or the share worked out from the one it reads. */
export function measureYs(m: Measure): MeasureY[] {
  return m.share ? [{ field: SHARE_FIELD, name: m.yLabel || 'Share' }] : sourceYs(m);
}

/** The fields dateParts adds to each row: not in the source, so never asked of the server. */
const partFields = (m: Measure): string[] => (m.dateParts ? [`${m.dateParts}_year`, `${m.dateParts}_month`] : []);

/** The source fields a measure reads, in the order the settings name them. */
export function measureSourceFields(m: Measure): string[] {
  const derived = partFields(m);
  const ys = typeof m.y === 'string' ? [m.y] : (m.y ?? []).map((y) => y.field);
  const named = [m.x, m.xWith, m.dateParts, ...ys, m.seriesBy, m.pick, m.standard?.field];
  return [...new Set(named.filter((f): f is string => !!f && !derived.includes(f)))];
}

const groupKey = (m: Measure, r: Attributes): string =>
  JSON.stringify([r[m.x], m.seriesBy ? r[m.seriesBy] : null, m.pick ? r[m.pick] : null]);

/** One row for each x, series, and pick, with every y field added up; a y with no number stays empty. */
function sumRows(m: Measure, rows: Attributes[]): Attributes[] {
  const fields = sourceYs(m).map((y) => y.field);
  const groups = new Map<string, Attributes>();
  for (const r of rows) {
    const key = groupKey(m, r);
    const into = groups.get(key);
    if (!into) {
      const first: Attributes = { ...r };
      for (const f of fields) first[f] = toNumber(r[f]);
      groups.set(key, first);
      continue;
    }
    for (const f of fields) {
      const n = toNumber(r[f]);
      if (n != null) into[f] = ((into[f] as number | null) ?? 0) + n;
    }
  }
  return [...groups.values()];
}

/** Each row's value as a share of the total across the series at its x (and pick). */
function withShares(m: Measure, rows: Attributes[]): Attributes[] {
  const field = sourceYs(m)[0].field;
  const at = (r: Attributes): string => JSON.stringify([r[m.x], m.pick ? r[m.pick] : null]);
  const totals = new Map<string, number>();
  for (const r of rows) totals.set(at(r), (totals.get(at(r)) ?? 0) + (toNumber(r[field]) ?? 0));
  return rows.map((r) => {
    const n = toNumber(r[field]);
    const total = totals.get(at(r)) ?? 0;
    return { ...r, [SHARE_FIELD]: n != null && total > 0 ? n / total : null };
  });
}

/**
 * Rows as the chart needs them, from rows as the source holds them: dates normalized, the
 * year and month read out of a date, a second field joined to x, rows added up, and counts
 * turned into shares. Each step runs only when the measure asks for it.
 */
export function shapeRows(m: Measure, rows: Attributes[]): Attributes[] {
  let out = rows.map((r) => {
    const row: Attributes = { ...r };
    if (m.xType === 'date') row[m.x] = normalizeDate(row[m.x]);
    if (m.dateParts) {
      const parts = isoParts(String(normalizeDate(row[m.dateParts]) ?? ''));
      row[`${m.dateParts}_year`] = parts ? parts.y : null;
      row[`${m.dateParts}_month`] = parts ? parts.m : null;
    }
    if (m.xWith) row[m.x] = [row[m.x], row[m.xWith]].filter((v) => v != null && v !== '').join(' ');
    if (m.seriesBy) {
      const s = row[m.seriesBy];
      row[m.seriesBy] = s == null || s === '' ? 'Not stated' : String(s);
    }
    return row;
  });
  if (m.combine === 'sum') out = sumRows(m, out);
  if (m.share) out = withShares(m, out);
  return out;
}

/** Rows for a measure from the map service, long and normalized. */
export async function queryMeasure(m: Measure, opts: ServiceOptions = {}): Promise<Attributes[]> {
  const groups = [m.x, m.seriesBy, m.pick].filter((f): f is string => !!f);
  const layer = m.layer ?? '';
  let rows: Attributes[];
  if (m.csv) {
    const response = await fetch(m.csv);
    if (!response.ok) throw new Error(`${m.csv} returned ${response.status}`);
    rows = parseCsv(await response.text());
  } else if (m.json) {
    const response = await fetch(m.json);
    if (!response.ok) throw new Error(`${m.json} returned ${response.status}`);
    const body = (await response.json()) as Attributes[] | { rows?: Attributes[] };
    rows = Array.isArray(body) ? body : (body.rows ?? []);
  } else if (m.layer == null) {
    throw new Error(`${m.title} has neither a layer nor a csv`);
  } else if (m.stat) {
    const ys = typeof m.y === 'string' ? null : m.y;
    rows = await queryStatistics(
      layer,
      ys
        ? { where: m.where, groupBy: groups, statisticType: m.stat, onField: ys[0].field, outName: ys[0].field,
            more: ys.slice(1).map((y) => ({ onField: y.field, outName: y.field })) }
        : { where: m.where, groupBy: groups, statisticType: m.stat, onField: m.y as string, outName: 'value' },
      opts,
    );
  } else if (m.unpivot) {
    rows = await queryFeatures(layer, { where: m.where }, opts);
    rows = unpivot(rows, m.unpivot.prefix, m.x, typeof m.y === 'string' ? m.y : m.y[0].field);
  } else {
    const fields = measureSourceFields(m);
    // The server sorts by x when x is one of its fields; a part read from a date is sorted here.
    rows = await queryFeatures(layer, { where: m.where, outFields: fields, orderByFields: fields.includes(m.x) ? m.x : undefined }, opts);
  }
  return shapeRows(m, rows);
}

/** Rows with an x value, sorted (by value when sort is set, else by x), and capped at limit. */
export function measureView(m: Measure, rows: Attributes[]): Attributes[] {
  let out = rows.filter((r) => r[m.x] != null && r[m.x] !== '');
  const y0 = measureYs(m)[0].field;
  if (m.sort) {
    const dir = m.sort === 'desc' ? -1 : 1;
    out = [...out].sort((a, b) => dir * ((toNumber(a[y0]) ?? -Infinity) - (toNumber(b[y0]) ?? -Infinity)));
  } else if (!m.xType || m.xType === 'month') {
    out = [...out].sort((a, b) => Number(a[m.x]) - Number(b[m.x]));
  } else {
    const order = m.xOrder ?? [];
    const rank = (v: unknown): number => (order.includes(String(v)) ? order.indexOf(String(v)) : order.length);
    out = [...out].sort((a, b) => rank(a[m.x]) - rank(b[m.x]) || String(a[m.x]).localeCompare(String(b[m.x])));
  }
  return m.limit ? out.slice(0, m.limit) : out;
}

/** One series per seriesBy value (named through seriesNames or seriesPrefix), or one per y field. */
export function measureSeries(m: Measure, rows: Attributes[]): MeasureSeries[] {
  const ys = measureYs(m);
  if (m.seriesBy) {
    const by = m.seriesBy;
    const order = m.seriesOrder ?? [];
    const rank = (v: string): number => (order.includes(v) ? order.indexOf(v) : order.length);
    const values = [...new Set(rows.map((r) => String(r[by])))].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b));
    return values.map((v) => ({
      name: (m.seriesNames && m.seriesNames[v]) || `${m.seriesPrefix || ''}${v}`,
      key: v,
      field: ys[0].field,
      rows: rows.filter((r) => String(r[by]) === v),
    }));
  }
  return ys.map((y) => ({ name: y.name || m.yLabel || 'Value', key: y.field, field: y.field, rows }));
}

/** Table columns behind the chart: x, series, pick, each y, and the threshold field. */
export function measureColumns(m: Measure): MeasureColumn[] {
  const cols: MeasureColumn[] = [{ field: m.x, headerName: m.xLabel || 'Year' }];
  if (m.seriesBy) cols.push({ field: m.seriesBy, headerName: m.seriesLabel || m.seriesBy });
  if (m.pick) cols.push({ field: m.pick, headerName: m.pickLabel || m.pick });
  for (const y of measureYs(m)) cols.push({ field: y.field, headerName: y.name || m.yLabel || 'Value', num: true });
  // A share is of a count; the count it came from stays in the table as a plain number.
  if (m.share) cols.push({ field: sourceYs(m)[0].field, headerName: m.yName || 'Count', num: true, format: '' });
  if (m.standard && m.standard.field) cols.push({ field: m.standard.field, headerName: m.standard.label || 'Threshold' });
  return cols;
}

/** Distinct pick values, sorted. Empty when the measure has no pick. */
export function pickChoices(m: Measure, rows: Attributes[]): string[] {
  if (!m.pick) return [];
  const field = m.pick;
  return [...new Set(rows.map((r) => r[field]).filter((v) => v != null && v !== '').map(String))].sort();
}

/** pickDefault when it is a choice, else the choice with the longest record. */
export function defaultPick(m: Measure, rows: Attributes[], choices: string[]): string | undefined {
  if (!m.pick || !choices.length) return undefined;
  if (m.pickDefault && choices.includes(m.pickDefault)) return m.pickDefault;
  const field = m.pick;
  const counts = new Map<string, number>();
  for (const r of rows) {
    const v = r[field];
    if (v == null || v === '') continue;
    counts.set(String(v), (counts.get(String(v)) ?? 0) + 1);
  }
  return choices.reduce((best, c) => ((counts.get(c) ?? 0) > (counts.get(best) ?? 0) ? c : best), choices[0]);
}

/** Rows for the picked value, or every row when the measure has no pick. */
export function pickedRows(m: Measure, rows: Attributes[], picked: string | undefined): Attributes[] {
  if (!m.pick || picked == null) return rows;
  const field = m.pick;
  return rows.filter((r) => String(r[field]) === picked);
}

/** Display text for an x value: month names, xNames, else the value itself. */
export function xDisplay(m: Measure, v: unknown): string {
  if (m.xType === 'month') {
    const n = Number(v);
    if (n >= 1 && n <= 12) return MONTHS[n - 1];
  }
  const key = String(v);
  if (m.xNames && m.xNames[key]) return m.xNames[key];
  if (m.xType === 'date' && m.dateStep === 'month') {
    const parts = isoParts(key);
    if (parts && parts.m >= 1 && parts.m <= 12) return formatMonthYear(parts.y, parts.m);
  }
  return key;
}

/** Threshold value from standard.value or the first finite standard.field value in rows, else null. */
export function measureThreshold(m: Measure, rows: Attributes[]): number | null {
  if (!m.standard) return null;
  if (m.standard.value != null && Number.isFinite(m.standard.value)) return m.standard.value;
  if (!m.standard.field) return null;
  const field = m.standard.field;
  for (const r of rows) {
    const n = toNumber(r[field]);
    if (n != null) return n;
  }
  return null;
}

/** Axis kind for a measure: dates on a time axis, text and months as bands, years linear for lines and bands for bars. */
export function measureAxisKind(m: Measure): AxisKind {
  if (m.xType === 'date') return 'time';
  if (m.xType) return 'band';
  const bars = m.type === 'bar' || m.type === 'stacked';
  return bars || m.orientation === 'h' ? 'band' : 'linear';
}

/** The chart spec for a measure and its (viewed) rows. */
export function measureChartSpec(m: Measure, rows: Attributes[]): ChartSpec {
  const series = measureSeries(m, rows);
  const horizontal = m.orientation === 'h';
  const type: ChartType = m.type === 'bar' || m.type === 'stacked' ? m.type : 'line';
  const xKind = measureAxisKind(m);
  const keys: string[] = [];
  const seen = new Set<string>();
  for (const r of rows) {
    const k = String(r[m.x]);
    if (!seen.has(k)) {
      seen.add(k);
      keys.push(k);
    }
  }
  const band = xKind === 'band' || horizontal;
  const categoryLabels: Record<string, string> = {};
  for (const k of keys) categoryLabels[k] = xDisplay(m, k);
  const std = horizontal ? null : measureThreshold(m, rows);
  return {
    title: m.title,
    type,
    horizontal,
    xKind,
    xLabel: horizontal ? undefined : m.xLabel,
    yLabel: m.yLabel || '',
    format: m.format,
    zero: m.zero !== false,
    categories: band ? keys : undefined,
    categoryLabels,
    threshold: std == null ? null : { value: std, label: `${(m.standard && m.standard.label) || 'Threshold'}: ${fmtValue(std, m.format)}` },
    ...(m.mirror ? { mirrored: true } : {}),
    ...(m.gaps != null ? { gaps: m.gaps } : {}),
    series: series.map((s) => ({
      name: s.name,
      ...(m.seriesColors?.[s.key] ? { color: m.seriesColors[s.key] } : {}),
      points: s.rows.map((r) => {
        const y = toNumber(r[s.field]);
        return {
          x: xKind === 'linear' ? Number(r[m.x]) : String(r[m.x]),
          y: y != null && m.mirror && s.key === m.mirror ? -y : y,
        };
      }),
    })),
  };
}

/** Empty-state copy per the embed contract: what is absent and what the section will show. */
export function emptyStateText(m: Measure): { title: string; description: string } {
  const what = m.yLabel || m.yName || 'values';
  const by = (m.xLabel || 'year').toLowerCase();
  return {
    title: `No ${m.title.toLowerCase()} loaded yet`,
    description: `This section will show ${what} by ${by}.`,
  };
}

/** Grid spans: explicit span, else pairs of span-6 with an unpaired last measure taking span-12. */
export function panelSpans(measures: Measure[]): MeasureSpan[] {
  const auto = measures.filter((x) => !x.span);
  return measures.map((m) => m.span || (auto.length % 2 === 1 && auto[auto.length - 1] === m ? 'span-12' : 'span-6'));
}

/* ---------- Sites monitored each year ---------- */

/**
 * A program's sitesPerYear in programs.json: the layer, year field, and site field to count
 * distinct sites per year from. extract: true groups a date field by its year on the server.
 */
export interface SitesPerYearConfig {
  layer: number | string;
  /** The map service the layer is in; the LTInfo_Monitoring service when omitted. */
  service?: string;
  year: string;
  site: string;
  where?: string;
  extract?: boolean;
  /** What is counted: "site" when omitted. */
  unit?: string;
}

/** The row shape sitesPerYearRows returns, and the x and y fields of its measure. */
export const SITES_PER_YEAR_X = 'year';
export const SITES_PER_YEAR_Y = 'count';

const capitalize = (s: string): string => (s ? s[0].toUpperCase() + s.slice(1) : s);

/**
 * The chart as a Measure, so mon-chart-panel draws it with the same toggle, table, CSV, and
 * states as every measurement: a bar per year of the distinct site count. The rows come from
 * querySitesPerYear instead of queryMeasure (ChartPanel passes the config as data-source).
 */
export function sitesPerYearMeasure(cfg: SitesPerYearConfig): Measure {
  const units = plural(2, cfg.unit || 'site');
  return {
    title: `${capitalize(units)} monitored each year`,
    sub: `Number of ${units} with a record in each year.`,
    layer: cfg.layer,
    service: cfg.service,
    x: SITES_PER_YEAR_X,
    xLabel: 'Year',
    y: SITES_PER_YEAR_Y,
    yLabel: `${capitalize(units)} monitored`,
    type: 'bar',
  };
}

/** The group-by key the server returns the year under: the field, or Expr1 for an EXTRACT. */
export function sitesPerYearYearKey(cfg: SitesPerYearConfig): string {
  return cfg.extract ? `EXTRACT(YEAR FROM ${cfg.year})` : cfg.year;
}

/**
 * Distinct sites per year from the grouped rows (one row per year and site). An EXTRACT
 * comes back as Expr1 (or EXPR1) rather than under the field name; years may arrive as
 * numbers, "2024" strings, dates, or epoch milliseconds. Sorted ascending by year.
 */
export function sitesPerYearRows(cfg: SitesPerYearConfig, rows: Attributes[]): Attributes[] {
  const bySite = new Map<number, Set<string>>();
  for (const r of rows) {
    const raw = cfg.extract ? (r.Expr1 ?? r.EXPR1 ?? r[cfg.year]) : r[cfg.year];
    const y = yearOf(raw);
    const site = r[cfg.site];
    if (!y || site == null || site === '') continue;
    const set = bySite.get(y) ?? new Set<string>();
    set.add(String(site));
    bySite.set(y, set);
  }
  return [...bySite.keys()].sort((a, b) => a - b).map((y) => ({ [SITES_PER_YEAR_X]: y, [SITES_PER_YEAR_Y]: bySite.get(y)!.size }));
}

/** Sites monitored each year from the map service: one grouped statistics request, counted client side. */
export async function querySitesPerYear(cfg: SitesPerYearConfig, opts: ServiceOptions = {}): Promise<Attributes[]> {
  const rows = await queryStatistics(
    cfg.layer,
    { where: cfg.where, groupBy: [sitesPerYearYearKey(cfg), cfg.site], statisticType: 'count', onField: 'OBJECTID', outName: 'n' },
    opts,
  );
  return sitesPerYearRows(cfg, rows);
}

/** What ChartPanel passes as data-source when a panel's rows come from somewhere other than queryMeasure. */
export type PanelSource = { kind: 'sites-per-year'; config: SitesPerYearConfig };

/** The rows for a panel: its source when it has one, else the measure query. */
export function queryPanelRows(measure: Measure, source: PanelSource | null, opts: ServiceOptions = {}): Promise<Attributes[]> {
  const service = source?.kind === 'sites-per-year' ? source.config.service : measure.service;
  const options = service ? { ...opts, service } : opts;
  if (source?.kind === 'sites-per-year') return querySitesPerYear(source.config, options);
  return queryMeasure(measure, options);
}
