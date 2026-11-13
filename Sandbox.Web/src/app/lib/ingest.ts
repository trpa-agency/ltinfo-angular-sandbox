/*
 * ingest.ts: the ways data reaches the dashboard, what each way must meet before a chart or
 * map may read it, and the checks the app can run itself.
 *
 * Every source layer or file belongs to one ingestion path. A path has acceptance criteria of
 * two kinds: checks this module runs against the live source (auto), and conditions a person
 * confirms (review). The criteria are a draft for TRPA to edit; the checks are code.
 *
 * Pure apart from the fetch function passed in, so it runs the same in a test.
 */

import { parseCsv } from './csv';
import type { DataSource, DataUse, SourceLayer } from './data-lineage';
import { layerHref } from './data-lineage';

export type PathId = 'trpa-service' | 'partner-pipeline' | 'partner-service' | 'ltinfo' | 'file';

/** The automated checks, by ID. A criterion names the check that proves it. */
export type CheckId = 'answers' | 'layer-exists' | 'described' | 'fields' | 'records' | 'cited';

export interface Criterion {
  text: string;
  /** The automated check that covers it; absent when a person confirms it. */
  check?: CheckId;
}

export interface IngestPath {
  id: PathId;
  label: string;
  /** Who holds the data and how it gets here, in one sentence. */
  summary: string;
  steward: string;
  criteria: Criterion[];
}

const ANSWERS: Criterion = { text: 'The source answers a request from the browser.', check: 'answers' };
const LAYER_EXISTS: Criterion = { text: 'The layer or table named in the settings exists.', check: 'layer-exists' };
const FIELDS: Criterion = { text: 'Every field the chart or map reads exists in the source.', check: 'fields' };
const RECORDS: Criterion = { text: 'The filter returns at least one record.', check: 'records' };
const DESCRIBED: Criterion = { text: 'The layer has a description in the service directory.', check: 'described' };

/** The five paths, in the order the page lists them. */
export const INGEST_PATHS: readonly IngestPath[] = [
  {
    id: 'trpa-service',
    label: 'TRPA Web Service',
    summary: 'Data TRPA collects or maintains, published from the enterprise geodatabase as a service on maps.trpa.org.',
    steward: 'TRPA program lead',
    criteria: [
      ANSWERS,
      LAYER_EXISTS,
      FIELDS,
      RECORDS,
      DESCRIBED,
      { text: 'A TRPA data steward is named for the layer.' },
      { text: 'The update schedule is written down, and the latest update is inside it.' },
      { text: 'Field names and units are documented in a data dictionary.' },
    ],
  },
  {
    id: 'partner-pipeline',
    label: 'Partner Data, TRPA Pipeline',
    summary: 'Data a partner agency owns, pulled by a TRPA pipeline, stored at TRPA, and published as a TRPA web service.',
    steward: 'Partner agency data steward, with a TRPA pipeline owner',
    criteria: [
      ANSWERS,
      LAYER_EXISTS,
      FIELDS,
      RECORDS,
      DESCRIBED,
      { text: 'The partner agency and its data steward are named, with the address the data is pulled from.' },
      { text: 'The pipeline is a script in a TRPA repository with a config file, logging, and no secrets in code.' },
      { text: 'Each run compares record counts and value ranges against the partner source and logs the result.' },
      { text: 'The refresh schedule is set, and a failed run alerts the pipeline owner.' },
      { text: 'The partner steward has reviewed the published layer once.' },
    ],
  },
  {
    id: 'partner-service',
    label: 'Partner Web Service',
    summary: 'Data read live from a partner agency’s own web service. The partner publishes it; the dashboard only reads it.',
    steward: 'Partner agency data steward',
    criteria: [
      ANSWERS,
      LAYER_EXISTS,
      FIELDS,
      RECORDS,
      { text: 'The partner data steward is named and has agreed to the use.' },
      { text: 'The service is public and allows requests from laketahoeinfo.org.' },
      { text: 'The partner gives notice before a field or layer changes.' },
      { text: 'Null rates and value ranges were reviewed before the first chart was built.' },
      { text: 'A dated snapshot is kept, so the page has a fallback when the service is down.' },
    ],
  },
  {
    id: 'ltinfo',
    label: 'LT Info Entered Data',
    summary: 'Programs, partners, photos, and site locations that staff enter in LT Info and the app reads from the LT Info API.',
    steward: 'LT Info program editor',
    criteria: [
      { text: 'The record is entered by a signed-in user with the editor role.' },
      { text: 'Required fields are filled: name, category, description, and monitoring approach.' },
      { text: 'Each site has a latitude and longitude inside the Tahoe Region.' },
      { text: 'The API route returns the documented shape; the API tests cover it.' },
      { text: 'The program lead has reviewed the page once after entry.' },
    ],
  },
  {
    id: 'file',
    label: 'Extracted File',
    summary: 'Numbers copied once from a published report or page into a file the app serves. An interim path until a service publishes them.',
    steward: 'TRPA analyst who made the file',
    criteria: [
      { text: 'The file loads and holds at least one record.', check: 'answers' },
      FIELDS,
      { text: 'The chart or map cites the original source.', check: 'cited' },
      { text: 'The script that made the file is in the repository, so the file can be rebuilt.' },
      { text: 'The original publication date is recorded.' },
      { text: 'A service is planned to replace the file.' },
    ],
  },
];

export const pathById = (id: PathId): IngestPath => INGEST_PATHS.find((p) => p.id === id)!;

/**
 * TRPA-hosted layers that hold partner agency data, by service name and layer ID ('all' for a
 * whole service). A URL cannot tell TRPA data from partner data, so this list is how a layer
 * gets the Partner Data, TRPA Pipeline path. Empty until TRPA fills it in.
 */
export const PARTNER_PIPELINE_LAYERS: Record<string, number[] | 'all'> = {};

const TRPA_HOST = /^https:\/\/maps\.trpa\.org\//;

/** The path a source layer or file comes in by. */
export function classify(source: DataSource, layer: number | null): PathId {
  if (source.kind === 'file') return 'file';
  if (!TRPA_HOST.test(source.key)) return 'partner-service';
  const listed = PARTNER_PIPELINE_LAYERS[source.name.replace(/ \((MapServer|FeatureServer)\)$/, '')];
  if (listed === 'all' || (layer !== null && listed?.includes(layer))) return 'partner-pipeline';
  return 'trpa-service';
}

/* ---------- The automated checks ---------- */

export type CheckStatus = 'pass' | 'fail' | 'skip';

export interface CheckResult {
  check: CheckId;
  label: string;
  status: CheckStatus;
  /** What was found: "1,204 records", "Missing: Site_Name". */
  detail: string;
}

/** The results for one layer or file: its own checks, then one list per use, in use order. */
export interface LayerReport {
  layer: CheckResult[];
  uses: CheckResult[][];
}

export const CHECK_LABELS: Record<CheckId, string> = {
  answers: 'Source answers',
  'layer-exists': 'Layer exists',
  described: 'Has a description',
  fields: 'Fields exist',
  records: 'Returns records',
  cited: 'Source cited',
};

const result = (check: CheckId, status: CheckStatus, detail: string): CheckResult => ({
  check,
  label: CHECK_LABELS[check],
  status,
  detail,
});

/** A plain field name; anything else (Shape.STArea() / 4046.86) is an expression the server computes. */
const FIELD_NAME = /^[A-Za-z_]\w*$/;

/**
 * Field names compare without case, as ArcGIS does. Expressions and fields the page makes are not
 * checked. A file's column can be any text ("Water level"), so anyName skips the expression test.
 */
export function fieldsCheck(use: DataUse, available: string[], anyName: boolean = false): CheckResult {
  const have = new Set(available.map((f) => f.toLowerCase()));
  const real = use.fields.filter((f) => !use.virtualFields.includes(f));
  const wanted = real.filter((f) => anyName || FIELD_NAME.test(f));
  const skipped = real.length - wanted.length;
  const note = skipped ? `, ${skipped} ${skipped === 1 ? 'expression' : 'expressions'} not checked` : '';
  if (!wanted.length) return result('fields', 'skip', skipped ? `Expressions only${note}` : 'No fields named');
  const missing = wanted.filter((f) => !have.has(f.toLowerCase()));
  return missing.length
    ? result('fields', 'fail', `Missing: ${missing.join(', ')}`)
    : result('fields', 'pass', `${wanted.length} of ${wanted.length} found${note}`);
}

export function citedCheck(use: DataUse): CheckResult {
  return use.upstream ? result('cited', 'pass', use.upstream) : result('cited', 'fail', 'No original source named');
}

const count = (n: number) => `${n.toLocaleString('en-US')} ${n === 1 ? 'record' : 'records'}`;

export type FetchLike = (url: string) => Promise<{ ok: boolean; status: number; json(): Promise<unknown>; text(): Promise<string> }>;

async function getJson<T>(fetchFn: FetchLike, url: string): Promise<T | null> {
  try {
    const response = await fetchFn(url);
    if (!response.ok) return null;
    const json = (await response.json()) as (T & { error?: unknown }) | null;
    return json && !json.error ? json : null;
  } catch {
    return null;
  }
}

/** A service layer: that it exists and is described, then each use's fields and record count. */
export async function checkServiceLayer(source: DataSource, layer: SourceLayer, fetchFn: FetchLike): Promise<LayerReport> {
  if (layer.layer === null) {
    return {
      layer: [result('layer-exists', 'fail', 'The settings name no layer')],
      uses: layer.uses.map(() => []),
    };
  }
  const href = layerHref(source, layer.layer);
  const info = await getJson<{ name?: string; description?: string | null; fields?: { name: string }[] | null }>(
    fetchFn,
    `${href}?f=json`,
  );
  if (!info?.name) {
    return {
      layer: [result('layer-exists', 'fail', `Layer ${layer.layer} did not answer`)],
      uses: layer.uses.map(() => []),
    };
  }
  const described = (info.description ?? '').trim().length > 0;
  const fields = (info.fields ?? []).map((f) => f.name);
  // One count per distinct filter, however many charts share it.
  const counts = new Map<string, CheckResult>();
  const uses: CheckResult[][] = [];
  for (const use of layer.uses) {
    const where = use.where || '1=1';
    if (!counts.has(where)) {
      const params = new URLSearchParams({ where, returnCountOnly: 'true', f: 'json' });
      const answer = await getJson<{ count?: number }>(fetchFn, `${href}/query?${params.toString()}`);
      counts.set(
        where,
        typeof answer?.count !== 'number'
          ? result('records', 'fail', 'The filter was refused')
          : answer.count > 0
            ? result('records', 'pass', count(answer.count))
            : result('records', 'fail', 'No records match the filter'),
      );
    }
    uses.push([fieldsCheck(use, fields), counts.get(where)!]);
  }
  return {
    layer: [
      result('layer-exists', 'pass', info.name),
      result('described', described ? 'pass' : 'fail', described ? 'Description present' : 'No description'),
    ],
    uses,
  };
}

/** The rows of a JSON, GeoJSON, or CSV file, as plain objects. */
export function fileRows(path: string, body: unknown): Record<string, unknown>[] | null {
  if (typeof body === 'string') return /\.csv(\?|$)/i.test(path) ? parseCsv(body) : null;
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  if (body && typeof body === 'object') {
    const o = body as { rows?: unknown; features?: { properties?: Record<string, unknown> }[] };
    if (Array.isArray(o.rows)) return o.rows as Record<string, unknown>[];
    if (Array.isArray(o.features)) return o.features.map((f) => f.properties ?? {});
  }
  return null;
}

/** A file: that it loads with records, then each use's fields and citation. */
export async function checkFile(source: DataSource, layer: SourceLayer, fetchFn: FetchLike): Promise<LayerReport> {
  let rows: Record<string, unknown>[] | null = null;
  try {
    const response = await fetchFn(source.key);
    if (response.ok) rows = fileRows(source.key, /\.csv(\?|$)/i.test(source.key) ? await response.text() : await response.json());
  } catch {
    rows = null;
  }
  if (!rows?.length) {
    return {
      layer: [result('answers', 'fail', rows ? 'The file holds no records' : 'The file did not load')],
      uses: layer.uses.map((use) => [citedCheck(use)]),
    };
  }
  const fields = Object.keys(rows[0]);
  return {
    layer: [result('answers', 'pass', count(rows.length))],
    uses: layer.uses.map((use) => [fieldsCheck(use, fields, true), citedCheck(use)]),
  };
}

/**
 * Every layer of a source, one at a time (the map server refuses a burst). Calls onLayer as
 * each report lands, so the page can fill in while the rest run.
 */
export async function checkSource(
  source: DataSource,
  fetchFn: FetchLike,
  onLayer: (key: string, report: LayerReport) => void,
): Promise<void> {
  for (const layer of source.layers) {
    const report = source.kind === 'file' ? await checkFile(source, layer, fetchFn) : await checkServiceLayer(source, layer, fetchFn);
    onLayer(layer.key, report);
  }
}

/** Passed and failed counts across a report; skipped checks count as neither. */
export function tally(reports: LayerReport[]): { pass: number; fail: number } {
  let pass = 0;
  let fail = 0;
  for (const r of reports) {
    for (const c of [...r.layer, ...r.uses.flat()]) {
      if (c.status === 'pass') pass += 1;
      else if (c.status === 'fail') fail += 1;
    }
  }
  return { pass, fail };
}
