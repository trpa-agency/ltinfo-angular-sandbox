/*
 * site-profile.ts: the data behind the site profile, the card that opens when a reader picks a
 * site or an area on a program map. Pure: no DOM, no Leaflet, no Angular. Every loader takes a
 * fetch implementation, so the queries and the shaping run under Node tests.
 *
 * A program's DashboardConfig.siteProfile (SiteProfileConfig below) says where one site's
 * yearly records live, what the value is called, the standard it is held to, the facts worth
 * showing, and any program-specific section. A program without one still gets a profile from
 * what the map already knows (siteSubject and areaSubject), so nothing regresses.
 *
 * Two ways to read a record:
 *   rows   the site's own rows (outFields *), averaged per year in the browser. The program's
 *          sites layer and its where clause are the default source.
 *   stats  stat set: the server groups the site's rows by year (EXTRACT(YEAR FROM date) when
 *          extractYear is set) and returns one row per year. For daily tables such as the bike
 *          and pedestrian counts and the LTIMP samples.
 * The comparison with the other sites (rank and median) reads the same layer once for every
 * site, three fields wide or grouped on the server, and is cached per layer and filter.
 */

import type { TopLevelSpec } from 'vega-lite';

import type { ChartSpec } from './chart/types';
import { normalizeDate } from './map-service';
import { vegaLiteSpec, type VegaTheme } from './vega-spec';
import {
  areaPopup,
  INACTIVE_COLOR,
  plural,
  queryUrl,
  SERVICE,
  siteStatus,
  sitePopup,
  slugify,
  sqlLiteral,
  unique,
  yearOf,
  type Feature,
  type FetchLike,
  type MapLayerConfig,
  type PopupCard,
  type QueryParams,
  type Site,
  type SitesPanelConfig,
} from './sites';

/* ---------- Configuration: DashboardConfig.siteProfile ---------- */

/** The standard a value is held to: a field on the latest row, a fixed value, or a value per category. */
export interface ProfileStandard {
  /** A field on the site's latest row (CNEL_LIMIT, State_Standard). */
  field?: string;
  /** A fixed value, when the data carries none. */
  value?: number;
  /** A field on the latest row whose value picks the standard from values (noise by land use). */
  byField?: string;
  values?: Record<string, number>;
  /** How sentences name it: "limit", "state standard". */
  label?: string;
}

/** How a site's rows are found in a record layer other than the program's own sites layer. */
export interface ProfileJoin {
  /** "name", "code", or a property of the map feature (SEZ_ID, ID). */
  from: string;
  /** The field in the record layer that holds that value. */
  to: string;
  /** "prefix" when the record field starts with the value and a space (LTIMP SiteName "10336698 THIRD CK"). */
  match?: 'equal' | 'prefix';
}

/** One yearly record of a site: where it lives and how to read and describe it. */
export interface ProfileRecordConfig {
  /** Record layer or table. The program's sitesLayer or mapLayer when omitted. */
  layer?: number;
  /** The map service the record layer is in; the service of the program's own layer when omitted. */
  service?: string;
  /** Base filter. The sitesLayer where clause when the layer is the program's sites layer. */
  where?: string;
  /** Required for an area layer or a layer other than the sites layer. */
  join?: ProfileJoin;
  /** Year field, or a date field with extractYear. */
  year: string;
  /** The year field is a date; the server groups on its year. */
  extractYear?: boolean;
  /** Value field. Text values such as "0.14" are read as numbers. */
  value: string;
  /** Group on the server: one value per site per year. Rows are fetched and averaged when omitted. */
  stat?: 'avg' | 'sum' | 'max' | 'min';
  /** What the value is: "Plant count", "Average CNEL". Names the chart. */
  label: string;
  /** A shorter label: the CSV column and the Latest section. label when omitted. */
  short?: string;
  /** Label of the latest-value fact. "Latest" when the value has a unit, else short or label. */
  latestLabel?: string;
  /** Appended to values: "dBA", "mg/L", "plants". */
  unit?: string;
  /** Unit for the change fact when it differs ("points" for a percent score). */
  changeUnit?: string;
  /** Decimals shown; 0 for whole numbers by default, 1 otherwise. */
  decimals?: number;
  /** What one record is called, singular and plural: ["survey", "surveys"]. */
  noun?: [string, string];
  standard?: ProfileStandard;
  /** A status field to count: "In attainment in 6 of 9 ratings". */
  status?: { field: string; value: string; label: string };
  /** A rating field to follow across years: "Rated B in 2019 and A in 2023". */
  rating?: { field: string; skip?: string[] };
  /** Rank and median against the program's other sites. Default true. */
  compare?: boolean;
  /** The value axis starts at zero. Default true. */
  zero?: boolean;
}

/** A value read from the site's latest row, else from the map feature, else from the site itself. */
export interface ProfileFieldConfig {
  /** One field, or fields tried in order until one has a value. */
  field?: string | string[];
  /** The site's own name, code, or key instead of a field. */
  from?: 'name' | 'code' | 'key';
  /** Display text for raw values ("ED" to "El Dorado"). */
  labels?: Record<string, string>;
  suffix?: string;
  decimals?: number;
}

export interface ProfileFactConfig extends ProfileFieldConfig {
  label: string;
}

/** SEZ: one table of indicator, rating, and score for the evaluation year on the map. */
export interface IndicatorsSection {
  type: 'indicators';
  title: string;
  rows: { label: string; rating: string; score?: string }[];
}

/** Aquatic invasive plants: a year-by-year status strip from wide columns, with the control actions. */
export interface StatusStripSection {
  type: 'statusStrip';
  title: string;
  years: number[];
  /** Column prefix of the status code per year: "Infest_Status_". */
  status: string;
  /** Column prefix of the actions per year: "Contr_". */
  actions?: string;
  /** The phase each code starts with: { "C": "Control" }. */
  phases?: Record<string, string>;
}

/** LTIMP: the latest sample of the record and of each related record. */
export interface LatestSection {
  type: 'latest';
  title: string;
}

export type ProfileSection = IndicatorsSection | StatusStripSection | LatestSection;

/** DashboardConfig.siteProfile: everything per program that the site profile reads. */
export interface SiteProfileConfig {
  /** The site's yearly record, drawn as the chart. */
  record?: ProfileRecordConfig;
  /** More records of the same site, each with its own small chart (LTIMP nitrogen). */
  related?: ProfileRecordConfig[];
  /** The agency or owner shown under the name. */
  owner?: ProfileFieldConfig;
  /** The one badge; the site's status or rating when omitted. */
  badge?: ProfileFieldConfig;
  /** Field with the site's Lake Tahoe Info page. */
  link?: string | string[];
  facts?: ProfileFactConfig[];
  section?: ProfileSection;
  /** Photos attached to the site's features in the map service. */
  photos?: ProfilePhotosConfig;
}

/**
 * Photos stored as ArcGIS attachments on the site's rows in a map service layer (SEZ: the
 * 2019 evaluation rows of each assessment unit; scenic: the viewpoints along a corridor
 * unit). The rows are found by a join, as a record is.
 */
export interface ProfilePhotosConfig {
  /** Layer that holds the attachments; the program's own layer when omitted. */
  layer?: number;
  /** The map service that layer is in; the service of the program's own layer when omitted. */
  service?: string;
  /**
   * How the site finds its rows in that layer, such as SEZ_ID to SEZ_ID. Several joins must
   * all match (a scenic corridor's viewpoints share its UNIT and its CATEGORY).
   */
  join: ProfileJoin | ProfileJoin[];
  /** Extra filter, such as rows that carry attachments ("CountAttachments > 0"). */
  where?: string;
  /** Field naming the year the photos belong to ("Threshold_Year"). */
  year?: string;
  /** Field naming the row each photo hangs on (a viewpoint ID), with an optional word before it. */
  label?: { field: string; prefix?: string };
  /**
   * "grid" (the default): up to four tiles. "panorama": the first photo full width and the rest
   * as a list, for wide photos that are too large to load four at a time.
   */
  layout?: 'grid' | 'panorama';
  /** Section title. */
  title?: string;
  /** Credit for every photo, shown in the larger view. */
  credit?: string;
}

/** One attached photo: its file in the map service, and the year and label of the row it hangs on. */
export interface ProfilePhoto {
  url: string;
  name: string;
  bytes: number;
  year: string | null;
  label: string | null;
}

/* ---------- Small helpers ---------- */

type Row = Record<string, unknown>;

/** Text that carries no value: empty, spaces, or a placeholder the layers use ("NA", "Null", "<Null>", "n/a"). */
export function isBlank(value: unknown): boolean {
  if (value == null) return true;
  if (typeof value === 'number') return !Number.isFinite(value);
  const t = String(value).trim().toLowerCase();
  return t === '' || t === 'na' || t === 'n/a' || t === 'null' || t === '<null>' || t === 'none';
}

function text(value: unknown): string {
  return isBlank(value) ? '' : String(value).trim();
}

/** A number from a number or numeric text, else null. */
export function numberOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value !== 'string' || isBlank(value)) return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
}

/** A number with a thousands separator and a fixed number of decimals at most. */
export function formatNumber(value: number, decimals?: number): string {
  const d = decimals ?? (Number.isInteger(value) ? 0 : 1);
  return value.toLocaleString('en-US', { maximumFractionDigits: d, minimumFractionDigits: 0 });
}

/** 1st, 2nd, 3rd, 4th, 11th, 12th, 13th, 21st. */
export function ordinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

/** "A", "A and B", "A, B, and C". */
export function listText(items: string[]): string {
  if (items.length <= 1) return items[0] ?? '';
  if (items.length === 2) return `${items[0]} and ${items[1]}`;
  return `${items.slice(0, -1).join(', ')}, and ${items[items.length - 1]}`;
}

const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'];

/** "March 5, 2020" from epoch milliseconds or an ISO date; anything else as text. */
export function formatDay(value: unknown): string {
  const iso = normalizeDate(value);
  const m = typeof iso === 'string' ? /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso) : null;
  if (!m) return text(value);
  return `${MONTHS[Number(m[2]) - 1]} ${Number(m[3])}, ${m[1]}`;
}

function capitalize(s: string): string {
  return s ? s[0].toUpperCase() + s.slice(1) : s;
}

/** A value with its unit: "42 plants", "55.2 dBA". */
export function withUnit(value: number, unit: string | undefined, decimals?: number): string {
  const n = formatNumber(value, decimals);
  if (!unit) return n;
  if (unit === 'percent') return `${n} percent`;
  // "1 plant", not "1 plants", for a plain plural word.
  return n === '1' && /^[a-z]+s$/.test(unit) ? `${n} ${unit.slice(0, -1)}` : `${n} ${unit}`;
}

/* ---------- The subject: what the map already knows about the picked site or area ---------- */

export interface ProfileSubject {
  kind: 'site' | 'area';
  /** The key the map and the list share. */
  key: string;
  name: string;
  /** Station or counter ID, or empty. */
  code: string;
  /** The status or rating the map colors it by, or null. */
  status: string | null;
  /** The map color of the feature (a token expression). */
  color: string;
  /** "1978 to 2025" from the map's site layer, or empty. */
  span: string;
  /** The feature's attributes (areas), or the site's own fields (sites). */
  props: Row;
  /** What one feature is called: "site", "station", "assessment unit". */
  unit: string;
  /** Today's popup facts, label and text, for the profile before or without its record. */
  basic: [string, string][];
}

function popupFacts(card: PopupCard): [string, string][] {
  const out: [string, string][] = [];
  for (const [label, value] of card.stats || []) if (value) out.push([label, value]);
  for (const [label, value] of card.rows || []) {
    if (typeof value === 'string' && value) out.push([label, value]);
  }
  return out;
}

/** The subject for a site from a sites layer: name, code, status, span, and today's popup facts. */
export function siteSubject(site: Site, color: string, unit: string = 'site'): ProfileSubject {
  const card = sitePopup(site, color);
  return {
    kind: 'site',
    key: site.key,
    name: site.name || 'Site',
    code: site.code,
    status: siteStatus(site),
    color,
    span: site.span,
    props: { name: site.name, code: site.code, first: site.first, last: site.last },
    unit,
    basic: popupFacts(card),
  };
}

/** The subject for an area from a map layer: name, rating, its attributes, and today's popup facts. */
export function areaSubject(cfg: MapLayerConfig, feature: Feature, key: string, fallback: string): ProfileSubject {
  const props = feature.properties || {};
  const card = areaPopup(cfg, feature, fallback);
  return {
    kind: 'area',
    key,
    name: card.title,
    code: '',
    status: card.pill?.text ?? null,
    color: card.pill?.color ?? fallback,
    span: '',
    props,
    unit: cfg.unit || 'area',
    basic: popupFacts(card),
  };
}

/* ---------- Resolving a record against the panel ---------- */

/** A record with its layer, filter, and the way a site's rows are found all worked out. */
export interface ResolvedRecord extends ProfileRecordConfig {
  layer: number;
  where: string;
  /**
   * How rows name their site. "site": the sites layer's code field, else its name field, as the
   * map collapses them. "join": the join's to field.
   */
  keyBy: { kind: 'site'; code?: string; name: string } | { kind: 'join'; join: ProfileJoin };
}

/** The layer and filter the panel itself draws, for a record or a profile that names none. */
function programSource(
  panel: SitesPanelConfig,
): { layer: number; service?: string; where: string; site?: { code?: string; name: string } } | null {
  if (panel.mapLayer) return { layer: panel.mapLayer.layer, service: panel.mapLayer.service, where: panel.mapLayer.where || '' };
  if (panel.sitesLayer) {
    return {
      layer: panel.sitesLayer.layer,
      service: panel.sitesLayer.service,
      where: panel.sitesLayer.where || '',
      site: { code: panel.sitesLayer.code, name: panel.sitesLayer.name },
    };
  }
  return null;
}

/**
 * The record with its defaults filled in, or null when the site's rows cannot be found (an area
 * layer with no join, or no layer at all).
 */
export function resolveRecord(record: ProfileRecordConfig, panel: SitesPanelConfig): ResolvedRecord | null {
  const program = programSource(panel);
  const layer = record.layer ?? program?.layer;
  if (layer == null) return null;
  const sameLayer = program != null && layer === program.layer;
  const where = record.where ?? (sameLayer ? program.where : '');
  // A record sits beside the program's own layer unless the settings name another service.
  const service = record.service ?? program?.service;
  if (record.join) return { ...record, layer, service, where, keyBy: { kind: 'join', join: record.join } };
  if (sameLayer && program.site) return { ...record, layer, service, where, keyBy: { kind: 'site', ...program.site } };
  return null;
}

/** The program's own layer as a record source with no value, for a profile that reads only facts or a section. */
export function resolveRowSource(panel: SitesPanelConfig): ResolvedRecord | null {
  const program = programSource(panel);
  if (!program?.site) return null;
  return {
    year: '',
    value: '',
    label: '',
    layer: program.layer,
    service: program.service,
    where: program.where,
    keyBy: { kind: 'site', ...program.site },
  };
}

/** The value of a join's from field for the subject. */
export function joinValue(from: string, subject: ProfileSubject): unknown {
  if (from === 'name') return subject.name;
  if (from === 'code') return subject.code;
  if (from === 'key') return subject.key;
  return subject.props[from];
}

function andWhere(base: string, clause: string): string {
  const trimmed = base.trim();
  return trimmed ? `(${trimmed}) AND (${clause})` : clause;
}

/** The where clause for one site's rows, or null when the subject lacks the value the join needs. */
export function subjectWhere(record: ResolvedRecord, subject: ProfileSubject): string | null {
  if (record.keyBy.kind === 'join') {
    const { from, to, match } = record.keyBy.join;
    const value = joinValue(from, subject);
    if (isBlank(value)) return null;
    if (match === 'prefix') {
      const pattern = `${String(value).trim()} %`.replace(/'/g, "''");
      return andWhere(record.where, `${to} LIKE '${pattern}'`);
    }
    const literal = typeof value === 'number' ? sqlLiteral(value) : sqlLiteral(String(value).trim());
    return andWhere(record.where, `${to} = ${literal}`);
  }
  const { code, name } = record.keyBy;
  if (code && subject.code) return andWhere(record.where, `${code} = ${sqlLiteral(subject.code)}`);
  return andWhere(record.where, `${name} = ${sqlLiteral(subject.name)}`);
}

/** The fields that name a row's site, in the order rowKey reads them. */
function keyFields(record: ResolvedRecord): string[] {
  if (record.keyBy.kind === 'join') return [record.keyBy.join.to];
  return [record.keyBy.code, record.keyBy.name].filter(Boolean) as string[];
}

/** The site a row belongs to, keyed as the map keys it (code when present, else name), or the join field. */
export function rowKey(record: ResolvedRecord, row: Row): string {
  if (record.keyBy.kind === 'join') return text(row[record.keyBy.join.to]);
  const { code, name } = record.keyBy;
  // Same rule as collapseSites: a null code falls back to the name.
  const raw = code ? (row[code] ?? row[name]) : row[name];
  return raw == null ? '' : String(raw).trim();
}

/* ---------- Queries ---------- */

const TECHNICAL_FIELDS = /^(GlobalID|created_user|created_date|last_edited_user|last_edited_date|Shape(\..*)?|Shape_Length|Shape_Area)$/i;

/** The year group of a stats query: the field, or EXTRACT(YEAR FROM field). */
function yearExpression(record: ResolvedRecord): string {
  return record.extractYear ? `EXTRACT(YEAR FROM ${record.year})` : record.year;
}

/** The year of a row: the year field, or the Expr column the server names an EXTRACT. */
export function rowYear(record: Pick<ProfileRecordConfig, 'year' | 'extractYear'>, row: Row): number | null {
  if (record.extractYear) {
    const expr = Object.keys(row).find((k) => /^expr\d*$/i.test(k));
    if (expr) return yearOf(row[expr]);
  }
  return yearOf(row[record.year]);
}

function statistics(record: ResolvedRecord): string {
  return JSON.stringify([
    { statisticType: record.stat, onStatisticField: record.value, outStatisticFieldName: 'value' },
    { statisticType: 'count', onStatisticField: record.value, outStatisticFieldName: 'n' },
  ]);
}

/** One site's rows: every field, no geometry, in year order. */
export function siteRowsParams(record: ResolvedRecord, where: string): QueryParams {
  return { where, outFields: '*', returnGeometry: false, ...(record.year ? { orderByFields: record.year } : {}) };
}

/** One site's yearly values, grouped on the server. */
export function siteStatsParams(record: ResolvedRecord, where: string): QueryParams {
  return { where, groupByFieldsForStatistics: yearExpression(record), outStatistics: statistics(record), returnGeometry: false };
}

/** One site's latest row (stats records): the standard and the latest sample come from it. */
export function latestRowParams(record: ResolvedRecord, where: string): QueryParams {
  return { where, outFields: '*', returnGeometry: false, orderByFields: `${record.year} DESC`, resultRecordCount: 1 };
}

/** Every site's values: three fields per row, or grouped per site and year on the server. */
export function comparisonParams(record: ResolvedRecord): QueryParams {
  const where = record.where.trim() || '1=1';
  if (record.stat) {
    return {
      where,
      groupByFieldsForStatistics: [...keyFields(record), yearExpression(record)].join(','),
      outStatistics: statistics(record),
      returnGeometry: false,
    };
  }
  return { where, outFields: unique([...keyFields(record), record.year, record.value]).join(','), returnGeometry: false };
}

interface AttributeResponse {
  features?: { attributes?: Row }[];
  exceededTransferLimit?: boolean;
  error?: { message?: string };
}

/** Attribute rows of an f=json query, paged with resultOffset when the server says there are more. */
export async function fetchRows(
  fetchFn: FetchLike,
  layer: number,
  params: QueryParams,
  pageSize: number = 2000,
  service: string = SERVICE,
): Promise<Row[]> {
  const out: Row[] = [];
  const paged = params['resultRecordCount'] == null && params['groupByFieldsForStatistics'] == null;
  for (let page = 0; page < 50; page++) {
    const query: QueryParams = { ...params, f: 'json' };
    if (paged) {
      query['resultOffset'] = page * pageSize;
      query['resultRecordCount'] = pageSize;
    }
    const response = await fetchFn(queryUrl(layer, query, service));
    const json = (await response.json()) as AttributeResponse | null;
    if (!json || typeof json !== 'object') throw new Error(`Layer ${layer} returned no JSON`);
    if (json.error) throw new Error(json.error.message || `Layer ${layer} query failed`);
    const rows = (json.features || []).map((f) => f.attributes || {});
    out.push(...rows);
    if (!paged || !json.exceededTransferLimit || rows.length === 0) break;
  }
  return out;
}

/* ---------- Attached photos ---------- */

interface AttachmentInfo {
  id: number;
  contentType?: string;
  size?: number;
  name?: string;
}

/**
 * The image attachments of the site's rows, newest year first. One query finds the rows; one
 * request per row lists its attachments. The files themselves are only URLs here: the browser
 * fetches them when they are shown.
 */
export async function loadPhotos(
  fetchFn: FetchLike,
  cfg: ProfilePhotosConfig,
  layer: number,
  subject: ProfileSubject,
  service: string = SERVICE,
): Promise<ProfilePhoto[]> {
  const where = photosWhere(cfg, subject);
  if (where == null) return [];
  const labelField = cfg.label?.field;
  const rows = await fetchRows(
    fetchFn,
    layer,
    {
      where,
      outFields: unique(['OBJECTID', cfg.year, labelField].filter(Boolean) as string[]).join(','),
      returnGeometry: false,
      orderByFields: cfg.year ? `${cfg.year} DESC` : undefined,
    },
    2000,
    service,
  );
  // Labels such as viewpoint IDs read in natural order: 3.2 before 3.10.
  if (labelField && !cfg.year) {
    rows.sort((a, b) => String(a[labelField] ?? '').localeCompare(String(b[labelField] ?? ''), undefined, { numeric: true }));
  }
  const lists = await Promise.all(
    rows.map(async (row) => {
      const oid = row['OBJECTID'];
      if (oid == null) return [];
      const base = `${service}/${layer}/${oid}/attachments`;
      const response = await fetchFn(`${base}?f=json`);
      const json = (await response.json()) as { attachmentInfos?: AttachmentInfo[] } | null;
      const year = cfg.year && !isBlank(row[cfg.year]) ? String(row[cfg.year]) : null;
      const label = labelField && !isBlank(row[labelField]) ? `${cfg.label?.prefix ?? ''}${String(row[labelField]).trim()}` : null;
      return (json?.attachmentInfos || [])
        .filter((a) => (a.contentType || '').startsWith('image/'))
        .map((a) => ({ url: `${base}/${a.id}`, name: a.name || '', bytes: a.size || 0, year, label }));
    }),
  );
  return lists.flat();
}

/** The where clause for a site's photo rows, or null when the site lacks a value a join needs. */
export function photosWhere(cfg: ProfilePhotosConfig, subject: ProfileSubject): string | null {
  const joins = Array.isArray(cfg.join) ? cfg.join : [cfg.join];
  const clauses: string[] = [];
  for (const join of joins) {
    const value = joinValue(join.from, subject);
    if (isBlank(value)) return null;
    const literal = typeof value === 'number' ? sqlLiteral(value) : sqlLiteral(String(value).trim());
    clauses.push(`${join.to} = ${literal}`);
  }
  if (cfg.where) clauses.push(cfg.where);
  return clauses.length > 1 ? clauses.map((c) => `(${c})`).join(' AND ') : clauses[0];
}

/* ---------- Yearly values ---------- */

export interface YearValue {
  year: number;
  value: number;
  /** Rows behind the value. */
  n: number;
}

/** One value per year from a site's own rows: the mean of the rows that have a value. */
export function yearlyFromRows(record: Pick<ProfileRecordConfig, 'year' | 'extractYear' | 'value'>, rows: Row[]): YearValue[] {
  const byYear = new Map<number, number[]>();
  for (const row of rows) {
    const year = rowYear(record, row);
    const value = numberOf(row[record.value]);
    if (year == null || value == null) continue;
    const list = byYear.get(year) ?? [];
    list.push(value);
    byYear.set(year, list);
  }
  return [...byYear.entries()]
    .map(([year, values]) => ({ year, value: values.reduce((a, b) => a + b, 0) / values.length, n: values.length }))
    .sort((a, b) => a.year - b.year);
}

/** One value per year from server statistics rows (value and n). */
export function yearlyFromStats(record: Pick<ProfileRecordConfig, 'year' | 'extractYear'>, rows: Row[]): YearValue[] {
  const out: YearValue[] = [];
  for (const row of rows) {
    const year = rowYear(record, row);
    const value = numberOf(row['value']);
    if (year == null || value == null) continue;
    out.push({ year, value, n: numberOf(row['n']) ?? 1 });
  }
  return out.sort((a, b) => a.year - b.year);
}

/** Every site's value per year: site key to year to value. Rows of one site and year are averaged. */
export type Comparison = Map<string, Map<number, number>>;

export function comparisonFromRows(record: ResolvedRecord, rows: Row[]): Comparison {
  const sums = new Map<string, Map<number, [number, number]>>();
  for (const row of rows) {
    const key = rowKey(record, row);
    if (!key) continue;
    const year = rowYear(record, row);
    const value = numberOf(record.stat ? row['value'] : row[record.value]);
    if (year == null || value == null) continue;
    const years = sums.get(key) ?? new Map<number, [number, number]>();
    const [sum, n] = years.get(year) ?? [0, 0];
    years.set(year, [sum + value, n + 1]);
    sums.set(key, years);
  }
  const out: Comparison = new Map();
  for (const [key, years] of sums) {
    out.set(key, new Map([...years].map(([year, [sum, n]]) => [year, sum / n])));
  }
  return out;
}

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/** The median of every site with a value, per year, for years with at least minSites sites, within [from, to]. */
export function medianByYear(comparison: Comparison, from: number, to: number, minSites: number = 3): YearValue[] {
  const byYear = new Map<number, number[]>();
  for (const years of comparison.values()) {
    for (const [year, value] of years) {
      if (year < from || year > to) continue;
      const list = byYear.get(year) ?? [];
      list.push(value);
      byYear.set(year, list);
    }
  }
  return [...byYear.entries()]
    .filter(([, values]) => values.length >= minSites)
    .map(([year, values]) => ({ year, value: median(values), n: values.length }))
    .sort((a, b) => a.year - b.year);
}

/** The comparison key that is this site: its own key, or the key that starts with the joined value. */
export function ownComparisonKey(record: ResolvedRecord, subject: ProfileSubject, comparison: Comparison): string | null {
  if (record.keyBy.kind === 'site') return comparison.has(subject.key) ? subject.key : null;
  const value = text(joinValue(record.keyBy.join.from, subject));
  if (!value) return null;
  if (record.keyBy.join.match === 'prefix') return [...comparison.keys()].find((k) => k.startsWith(`${value} `)) ?? null;
  return comparison.has(value) ? value : null;
}

/* ---------- Context sentences ---------- */

/** From this many sites on, a rank reads as a share: "Higher than 62 percent of 597 assessment units in 2023". */
export const RANK_AS_SHARE_FROM = 50;

/**
 * Where the site sits among the program's sites in its latest year: "4th highest of 34 sites in
 * 2024", "Highest of 12 stations in 2025", "Tied for lowest of 34 sites in 2025", or for a large
 * program "Higher than 62 percent of 597 assessment units in 2023". Null when fewer than three
 * sites have a value that year.
 */
export function rankLine(ownKey: string, year: number, comparison: Comparison, unit: string): string | null {
  const own = comparison.get(ownKey)?.get(year);
  if (own == null) return null;
  const others: number[] = [];
  for (const [key, years] of comparison) {
    if (key === ownKey) continue;
    const value = years.get(year);
    if (value != null) others.push(value);
  }
  const total = others.length + 1;
  if (total < 3) return null;
  const close = (a: number, b: number) => Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b));
  const higher = others.filter((v) => v > own && !close(v, own)).length;
  const tied = others.some((v) => close(v, own));
  const lowest = others.every((v) => v > own || close(v, own));
  const of = `of ${total} ${plural(total, unit)} in ${year}`;
  const tie = tied ? 'Tied for ' : '';
  if (higher === 0) return `${tie}${tied ? 'highest' : 'Highest'} ${of}`;
  if (lowest) return `${tie}${tied ? 'lowest' : 'Lowest'} ${of}`;
  if (total >= RANK_AS_SHARE_FROM) {
    const lower = others.filter((v) => v < own && !close(v, own)).length;
    return `Higher than ${Math.round((100 * lower) / others.length)} percent ${of}`;
  }
  return `${tie}${ordinal(higher + 1)} highest ${of}`;
}

/** The standard for the site from its latest row, or null. */
export function standardFor(standard: ProfileStandard | undefined, latest: Row | null): number | null {
  if (!standard) return null;
  if (standard.byField && standard.values && latest) {
    const key = text(latest[standard.byField]);
    const value = standard.values[key] ?? standard.values[key.toUpperCase()];
    if (value != null) return value;
  }
  if (standard.field && latest) {
    const value = numberOf(latest[standard.field]);
    if (value != null) return value;
  }
  return standard.value ?? null;
}

/** "Above the 55 dBA limit in 3 of 6 years", or "Below the 55 dBA limit in all 6 years". */
export function standardLine(yearly: YearValue[], standard: number, record: Pick<ProfileRecordConfig, 'unit' | 'decimals' | 'standard'>): string | null {
  if (!yearly.length) return null;
  const label = record.standard?.label || 'standard';
  const limit = `the ${withUnit(standard, record.unit, Math.max(record.decimals ?? 0, decimalsOf(standard)))} ${label}`;
  const above = yearly.filter((y) => y.value > standard).length;
  const years = `${yearly.length} ${plural(yearly.length, 'year')}`;
  const every = yearly.length === 1 ? `in ${yearly[0].year}` : yearly.length === 2 ? 'in both years' : `in all ${years}`;
  if (above === 0) return `Below ${limit} ${every}`;
  if (above === yearly.length) return `Above ${limit} ${every}`;
  return `Above ${limit} in ${above} of ${years}`;
}

function decimalsOf(value: number): number {
  const s = String(value);
  const dot = s.indexOf('.');
  return dot < 0 ? 0 : Math.min(3, s.length - dot - 1);
}

/** "In attainment in 6 of 9 ratings", one row per year (the latest row of a year wins). */
export function statusLine(record: ResolvedRecord, rows: Row[]): string | null {
  const status = record.status;
  if (!status) return null;
  const byYear = new Map<number, string>();
  for (const row of rows) {
    const year = rowYear(record, row);
    const value = text(row[status.field]);
    if (year != null && value) byYear.set(year, value);
  }
  const total = byYear.size;
  if (!total) return null;
  const hits = [...byYear.values()].filter((v) => v === status.value).length;
  const noun = record.noun ? record.noun[total === 1 ? 0 : 1] : plural(total, 'year');
  if (hits === total) {
    if (total === 1) return `${status.label} in ${[...byYear.keys()][0]}`;
    return total === 2 ? `${status.label} in both ${noun}` : `${status.label} in all ${total} ${noun}`;
  }
  return `${status.label} in ${hits} of ${total} ${noun}`;
}

/** "Rated B in 2019 and A in 2023", "Rated C in 2019 and 2023". Null with fewer than two rated years. */
export function ratingLine(record: ResolvedRecord, rows: Row[]): string | null {
  const rating = record.rating;
  if (!rating) return null;
  const skip = new Set(rating.skip || []);
  const byYear = new Map<number, string>();
  for (const row of rows) {
    const year = rowYear(record, row);
    const value = text(row[rating.field]);
    if (year != null && value && !skip.has(value)) byYear.set(year, value);
  }
  const entries = [...byYear.entries()].sort((a, b) => a[0] - b[0]);
  if (entries.length < 2) return null;
  const shown = entries.length > 4 ? [entries[0], entries[entries.length - 1]] : entries;
  if (shown.every(([, v]) => v === shown[0][1])) return `Rated ${shown[0][1]} in ${listText(shown.map(([y]) => String(y)))}`;
  return `Rated ${listText(shown.map(([y, v]) => `${v} in ${y}`))}`;
}

/* ---------- Facts ---------- */

/** The record span as a fact: "1979 to 2025, 32 surveys", "2019 and 2023, 2 evaluations". */
export function recordFact(yearly: YearValue[], noun: [string, string] = ['record', 'records']): string {
  if (!yearly.length) return '';
  const first = yearly[0].year;
  const last = yearly[yearly.length - 1].year;
  const span = first === last ? String(first) : yearly.length === 2 ? `${first} and ${last}` : `${first} to ${last}`;
  const n = yearly.reduce((sum, y) => sum + y.n, 0);
  return `${span}, ${n.toLocaleString('en-US')} ${n === 1 ? noun[0] : noun[1]}`;
}

/** The latest value as a fact: "42 plants in 2025", with the days counted for a yearly total. */
export function latestFact(yearly: YearValue[], record: Pick<ProfileRecordConfig, 'unit' | 'decimals' | 'stat' | 'noun'>): string {
  const latest = yearly[yearly.length - 1];
  if (!latest) return '';
  const value = `${withUnit(latest.value, record.unit, record.decimals)} in ${latest.year}`;
  if (record.stat === 'sum' && record.noun) return `${value} (${latest.n.toLocaleString('en-US')} ${latest.n === 1 ? record.noun[0] : record.noun[1]})`;
  return value;
}

/** The change from the previous record: "Down 102 plants since 2024", "No change since 2023". */
export function changeFact(yearly: YearValue[], record: Pick<ProfileRecordConfig, 'unit' | 'changeUnit' | 'decimals'>): string {
  if (yearly.length < 2) return '';
  const latest = yearly[yearly.length - 1];
  const previous = yearly[yearly.length - 2];
  const delta = latest.value - previous.value;
  const decimals = record.decimals ?? (Number.isInteger(latest.value) && Number.isInteger(previous.value) ? 0 : 1);
  const rounded = Number(delta.toFixed(decimals));
  if (rounded === 0) return `No change since ${previous.year}`;
  const unit = record.changeUnit ?? record.unit;
  return `${rounded > 0 ? 'Up' : 'Down'} ${withUnit(Math.abs(rounded), unit, decimals)} since ${previous.year}`;
}

/**
 * The record's high point, when it says something the latest value does not: at least five
 * years on record, the peak is not the latest year, and it is at least 25 percent above the
 * latest value. "1,838 plants in 1992"; empty otherwise.
 */
export function peakFact(yearly: YearValue[], record: Pick<ProfileRecordConfig, 'unit' | 'decimals'>): string {
  if (yearly.length < 5) return '';
  const latest = yearly[yearly.length - 1];
  const peak = yearly.reduce((best, y) => (y.value > best.value ? y : best), yearly[0]);
  if (peak.year === latest.year || peak.value <= 0 || peak.value < latest.value * 1.25) return '';
  return `${withUnit(peak.value, record.unit, record.decimals)} in ${peak.year}`;
}

/** A configured value from the latest row, else the feature or site, formatted; empty when nothing has one. */
export function fieldValue(cfg: ProfileFieldConfig, subject: ProfileSubject, latest: Row | null): string {
  let raw: unknown = null;
  if (cfg.from) raw = joinValue(cfg.from, subject);
  const fields = cfg.field == null ? [] : Array.isArray(cfg.field) ? cfg.field : [cfg.field];
  for (const field of fields) {
    if (!isBlank(raw)) break;
    raw = latest && !isBlank(latest[field]) ? latest[field] : subject.props[field];
  }
  if (isBlank(raw)) return '';
  const key = String(raw).trim();
  if (cfg.labels && cfg.labels[key] != null) return cfg.labels[key];
  const n = typeof raw === 'number' ? raw : null;
  const shown = n != null ? formatNumber(n, cfg.decimals) : key;
  return `${shown}${cfg.suffix || ''}`;
}

/** The Lake Tahoe Info page of the site, when its row carries one. */
export function linkFor(link: string | string[] | undefined, subject: ProfileSubject, latest: Row | null): string | null {
  for (const field of link == null ? [] : Array.isArray(link) ? link : [link]) {
    const value = text(latest?.[field] ?? subject.props[field]);
    if (/^https?:\/\//i.test(value)) return value;
  }
  return null;
}

/** The one badge: the configured field, else the map status unless it is the generic "Monitoring station". */
export function badgeFor(profile: SiteProfileConfig | null, subject: ProfileSubject, latest: Row | null): string {
  if (profile?.badge) {
    const value = fieldValue(profile.badge, subject, latest);
    if (value) return value;
  }
  return subject.status && subject.status !== 'Monitoring station' ? subject.status : '';
}

/* ---------- Program sections ---------- */

export interface IndicatorRow {
  label: string;
  rating: string;
  score: string;
}

/** The indicator table for one row: indicators with a rating or a score. */
export function indicatorRows(section: IndicatorsSection, row: Row | null): IndicatorRow[] {
  if (!row) return [];
  return section.rows
    .map((r) => {
      const score = r.score ? numberOf(row[r.score]) : null;
      return { label: r.label, rating: text(row[r.rating]), score: score == null ? '' : formatNumber(score) };
    })
    .filter((r) => r.rating || r.score);
}

export interface StripCell {
  year: number;
  /** The status code, or empty. */
  code: string;
  /** The phase the code starts with ("Control"), or empty. */
  phase: string;
  actions: string;
}

/** One cell per configured year from the wide columns, oldest first. */
export function statusStrip(section: StatusStripSection, row: Row | null): StripCell[] {
  if (!row) return [];
  return [...section.years]
    .sort((a, b) => a - b)
    .map((year) => {
      const code = text(row[`${section.status}${year}`]);
      const phase = code && section.phases ? (section.phases[code[0].toUpperCase()] ?? '') : '';
      return { year, code, phase, actions: section.actions ? text(row[`${section.actions}${year}`]) : '' };
    });
}

/** The phases in the strip, in config order, with a palette color each, for the strip and its legend. */
export function stripPhases(section: StatusStripSection, palette: readonly string[]): { phase: string; color: string }[] {
  return Object.values(section.phases || {}).map((phase, i) => ({ phase, color: palette[i % palette.length] }));
}

/* ---------- The chart ---------- */

export const SITE_SERIES = 'This site';
export const MEDIAN_SERIES = 'Median of all sites';

/**
 * The record as a ChartSpec for vegaLiteSpec: the site's values, the median of all sites in the
 * years the site covers, and the standard as the dashed threshold. Years on a linear axis.
 */
export function profileChartSpec(
  title: string,
  yearly: YearValue[],
  medians: YearValue[],
  standard: number | null,
  record: Pick<ProfileRecordConfig, 'unit' | 'decimals' | 'standard' | 'zero'>,
  unitPlural: string = 'sites',
): ChartSpec {
  const series = [{ name: SITE_SERIES, points: yearly.map((y) => ({ x: y.year, y: y.value })) }];
  if (medians.length >= 2) series.push({ name: `Median of all ${unitPlural}`, points: medians.map((y) => ({ x: y.year, y: y.value })) });
  const label = capitalize(record.standard?.label || 'standard');
  return {
    title,
    type: 'line',
    xKind: 'linear',
    zero: record.zero !== false,
    threshold:
      standard == null
        ? null
        : { value: standard, label: `${label} ${withUnit(standard, record.unit, Math.max(record.decimals ?? 0, decimalsOf(standard)))}` },
    series,
  };
}

type Json = Record<string, unknown>;

/**
 * The Vega-Lite spec of a profile chart: vegaLiteSpec's spec, made quieter for a small card.
 * The series legend goes (the card draws a one-line key), only this site's line carries point
 * marks, and the median line is thinner, so the site reads first.
 */
export function profileVegaSpec(spec: ChartSpec, theme: VegaTheme, width: number, height: number): TopLevelSpec {
  const out = vegaLiteSpec(spec, theme, { width, height }) as unknown as Json;
  const layers = (out['layer'] as Json[] | undefined) ?? [];
  // The standard's in-plot label can sit on the data in a chart this small; the card's key
  // names the standard instead, so only the dashed rule stays in the plot.
  const thresholdLabel = spec.threshold?.label;
  if (thresholdLabel) {
    out['layer'] = layers.filter((layer) => {
      const mark = layer['mark'] as Json | undefined;
      return !(mark?.['type'] === 'text' && mark['text'] === thresholdLabel);
    });
  }
  for (const layer of (out['layer'] as Json[] | undefined) ?? []) {
    const encoding = layer['encoding'] as Json | undefined;
    for (const channel of ['color', 'shape']) {
      const enc = encoding?.[channel] as Json | undefined;
      if (enc && 'legend' in enc) enc['legend'] = null;
    }
    const mark = layer['mark'] as Json | undefined;
    const transforms = (layer['transform'] as Json[] | undefined) ?? [];
    const hover = transforms.some((t) => (t['filter'] as Json | undefined)?.['param'] != null);
    if (mark?.['type'] === 'point' && !hover && layer['data'] == null) {
      layer['transform'] = [...transforms, { filter: 'datum.o === 0' }];
    }
    if (mark?.['type'] === 'line' && encoding && spec.series.length > 1) {
      encoding['strokeWidth'] = { condition: { test: 'datum.o === 0', value: 2 }, value: 1.5 };
    }
  }
  return out as unknown as TopLevelSpec;
}

/** The values for screen readers and the table under the chart: year, this site, and the median. */
export function chartRows(yearly: YearValue[], medians: YearValue[], decimals?: number): { year: number; value: string; median: string }[] {
  const byYear = new Map(medians.map((m) => [m.year, m.value]));
  return yearly.map((y) => {
    const m = byYear.get(y.year);
    return { year: y.year, value: formatNumber(y.value, decimals), median: m == null ? '' : formatNumber(m, decimals) };
  });
}

/* ---------- Loading a profile ---------- */

export interface RecordResult {
  record: ResolvedRecord;
  /** The site's own rows (rows records), else empty. */
  rows: Row[];
  /** The site's latest row: the last of rows, or the latest row query of a stats record. */
  latest: Row | null;
  yearly: YearValue[];
  standard: number | null;
  /** How many requests and how long they took, for the report and the tests. */
  ms: number;
}

/** The rows and yearly values of one site for one record. Throws when a query fails. */
export async function loadRecord(fetchFn: FetchLike, record: ResolvedRecord, subject: ProfileSubject): Promise<RecordResult | null> {
  const where = subjectWhere(record, subject);
  if (!where) return null;
  const started = Date.now();
  if (record.stat) {
    const [stats, latestRows] = await Promise.all([
      fetchRows(fetchFn, record.layer, siteStatsParams(record, where), 2000, record.service),
      fetchRows(fetchFn, record.layer, latestRowParams(record, where), 2000, record.service),
    ]);
    const latest = latestRows[0] ?? null;
    return {
      record,
      rows: [],
      latest,
      yearly: yearlyFromStats(record, stats),
      standard: standardFor(record.standard, latest),
      ms: Date.now() - started,
    };
  }
  const rows = await fetchRows(fetchFn, record.layer, siteRowsParams(record, where), 2000, record.service);
  const yearly = record.value ? yearlyFromRows(record, rows) : [];
  const valued = record.value ? rows.filter((r) => numberOf(r[record.value]) != null) : rows;
  const latest = valued[valued.length - 1] ?? rows[rows.length - 1] ?? null;
  return { record, rows, latest, yearly, standard: standardFor(record.standard, latest), ms: Date.now() - started };
}

const comparisons = new Map<string, Promise<Comparison>>();

/** Every site's values for a record, fetched once per layer, filter, and fields, then shared. */
export function loadComparison(fetchFn: FetchLike, record: ResolvedRecord): Promise<Comparison> {
  const params = comparisonParams(record);
  const cacheKey = JSON.stringify([record.service ?? '', record.layer, params]);
  let pending = comparisons.get(cacheKey);
  if (!pending) {
    pending = fetchRows(fetchFn, record.layer, params, 2000, record.service).then((rows) => comparisonFromRows(record, rows));
    // A failed load is not cached, so the next profile tries again.
    pending.catch(() => comparisons.delete(cacheKey));
    comparisons.set(cacheKey, pending);
  }
  return pending;
}

/* ---------- CSV of the rows behind the profile ---------- */

/** The CSV columns of a site's own rows: every field but the technical ones, in row order. */
function rowColumns(rows: Row[]): string[] {
  return unique(rows.flatMap((r) => Object.keys(r))).filter((k) => !TECHNICAL_FIELDS.test(k));
}

function csvCell(value: unknown): string {
  const t = value == null ? '' : String(value);
  return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
}

/** Epoch dates as ISO dates, so a spreadsheet reads them. */
function csvValue(field: string, value: unknown): unknown {
  return typeof value === 'number' && value > 1e11 && /date|time/i.test(field) ? normalizeDate(value) : value;
}

export interface ProfileCsv {
  fileName: string;
  text: string;
  /** Data rows, header excluded. */
  rows: number;
}

/**
 * The records behind the profile as one CSV. A rows record gives the site's own rows with their
 * fields; a stats record gives one row per year (year, value, count). Several records share the
 * file with a Record column first. A profile with no record gives the facts the map knows.
 */
export function profileCsv(programName: string, subject: ProfileSubject, results: RecordResult[]): ProfileCsv {
  const fileName = `${slugify(`${programName} ${subject.name}`) || 'site'}-records.csv`;
  const tables: { name: string; columns: string[]; rows: Row[] }[] = results.map((r) => {
    if (r.record.stat) {
      const valueColumn = `${r.record.short || r.record.label}${r.record.unit ? ` (${r.record.unit})` : ''}`;
      const countColumn = capitalize(r.record.noun?.[1] || 'records');
      return {
        name: r.record.short || r.record.label,
        columns: ['Year', valueColumn, countColumn],
        rows: r.yearly.map((y) => ({ Year: y.year, [valueColumn]: y.value, [countColumn]: y.n })),
      };
    }
    const columns = rowColumns(r.rows);
    return {
      name: r.record.short || r.record.label || 'Record',
      columns,
      rows: r.rows.map((row) => Object.fromEntries(columns.map((c) => [c, csvValue(c, row[c])]))),
    };
  });
  let columns: string[];
  let rows: Row[];
  if (!tables.length || tables.every((t) => !t.rows.length)) {
    const facts: Row = { Name: subject.name, ...Object.fromEntries(subject.basic) };
    columns = Object.keys(facts);
    rows = [facts];
  } else if (tables.length === 1) {
    columns = tables[0].columns;
    rows = tables[0].rows;
  } else {
    columns = ['Record', ...unique(tables.flatMap((t) => t.columns))];
    rows = tables.flatMap((t) => t.rows.map((r) => ({ Record: t.name, ...r })));
  }
  const lines = [columns.map(csvCell).join(','), ...rows.map((r) => columns.map((c) => csvCell(r[c])).join(','))];
  return { fileName, text: `${lines.join('\r\n')}\r\n`, rows: rows.length };
}

/* ---------- Everything the card shows, worked out from what has loaded ---------- */

export interface ProfileView {
  name: string;
  badge: string;
  owner: string;
  facts: [string, string][];
  context: string[];
  link: string | null;
}

/**
 * The header, facts, and context lines from the subject and whatever records have arrived.
 * Before the record lands (or when it fails, or the program has no profile) the facts are the
 * ones the map already knows.
 */
export function profileView(
  profile: SiteProfileConfig | null,
  subject: ProfileSubject,
  main: RecordResult | null,
  comparison: Comparison | null,
): ProfileView {
  const latest = main?.latest ?? null;
  const facts: [string, string][] = [];
  const context: string[] = [];
  const record = main?.record;
  if (main && record && main.yearly.length) {
    facts.push(['Record', recordFact(main.yearly, record.noun)]);
    // With a unit the value says what it is ("42 plants"); without one the label does.
    facts.push([record.latestLabel || (record.unit ? 'Latest' : record.short || record.label), latestFact(main.yearly, record)]);
    const change = changeFact(main.yearly, record);
    if (change) facts.push(['Change', change]);
    const peak = peakFact(main.yearly, record);
    if (peak) facts.push(['Peak', peak]);
  } else {
    // The map's own facts, without the ones a configured fact repeats.
    const configured = new Set((profile?.facts || []).map((f) => f.label));
    const header = [badgeFor(profile, subject, latest), profile?.owner ? fieldValue(profile.owner, subject, latest) : ''];
    for (const fact of subject.basic) if (!configured.has(fact[0]) && !header.includes(fact[1])) facts.push(fact);
  }
  for (const fact of profile?.facts || []) {
    const value = fieldValue(fact, subject, latest);
    // A fact already shown under another label (the map's Station ID) is not repeated.
    if (value && !facts.some(([label, shown]) => label === fact.label || shown === value)) facts.push([fact.label, value]);
  }
  if (main && record) {
    if (comparison && record.compare !== false && main.yearly.length) {
      const own = ownComparisonKey(record, subject, comparison);
      const year = main.yearly[main.yearly.length - 1].year;
      const line = own ? rankLine(own, year, comparison, subject.unit) : null;
      if (line) context.push(line);
    }
    if (main.standard != null) {
      const line = standardLine(main.yearly, main.standard, record);
      if (line) context.push(line);
    }
    const status = statusLine(record, main.rows);
    if (status) context.push(status);
    const rating = ratingLine(record, main.rows);
    if (rating) context.push(rating);
  }
  return {
    name: subject.name,
    badge: badgeFor(profile, subject, latest),
    owner: profile?.owner ? fieldValue(profile.owner, subject, latest) : '',
    facts,
    context: context.map((line) => `${line}.`),
    link: profile ? linkFor(profile.link, subject, latest) : null,
  };
}

/** The row the indicator table reads: the record row of the year on the map, else the latest. */
export function rowForYear(main: RecordResult | null, year: unknown): Row | null {
  if (!main) return null;
  const wanted = yearOf(year);
  if (wanted != null) {
    const row = [...main.rows].reverse().find((r) => rowYear(main.record, r) === wanted);
    if (row) return row;
  }
  return main.latest;
}

/** The latest sample of a record for the Latest section: label, value with unit, and day. */
export function latestSample(result: RecordResult): [string, string, string] | null {
  const row = result.latest;
  if (!row) return null;
  const value = numberOf(row[result.record.value]);
  if (value == null) return null;
  return [result.record.short || result.record.label, withUnit(value, result.record.unit, result.record.decimals), formatDay(row[result.record.year])];
}

/** The color used for a site with no status color. */
export const PROFILE_FALLBACK_COLOR = INACTIVE_COLOR;
