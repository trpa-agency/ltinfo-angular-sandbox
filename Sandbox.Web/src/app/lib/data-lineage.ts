/*
 * data-lineage.ts: where each chart, map, and site list on a program page reads its data.
 *
 * A program's DashboardConfig names its sources in six places (measures, sitesLayer,
 * sitesPerYear, mapLayer, overlays, siteProfile). This module walks them all, applies the same
 * defaults the panels apply (the LTInfo_Monitoring service when a layer names no service, the
 * program's own sites or map layer when a site profile names no layer), and groups the result
 * by source and layer. Pure, no DOM.
 */

import type { Measure } from './measures';
import { SERVICE } from './sites';
import type { DashboardConfig } from '../api/models';

/** What a program page does with the rows: the six DashboardConfig keys, in reading order. */
export type UseKind = 'chart' | 'map' | 'sites' | 'sites-per-year' | 'overlay' | 'profile';

export const USE_KINDS: readonly UseKind[] = ['chart', 'map', 'sites', 'sites-per-year', 'overlay', 'profile'];

export const USE_LABELS: Record<UseKind, string> = {
  chart: 'Chart',
  map: 'Map',
  sites: 'Site list',
  'sites-per-year': 'Sites per year',
  overlay: 'Map overlay',
  profile: 'Site profile',
};

/** The DashboardConfig key each kind comes from. */
export const USE_KEYS: Record<UseKind, string> = {
  chart: 'measures',
  map: 'mapLayer',
  sites: 'sitesLayer',
  'sites-per-year': 'sitesPerYear',
  overlay: 'overlays',
  profile: 'siteProfile',
};

/** A map service on an ArcGIS Server, or a file the app serves from public/data (or reads by URL). */
export type SourceKind = 'service' | 'file';

/** One chart, map, or list on one program page. */
export interface DataUse {
  programId: number;
  kind: UseKind;
  /** The chart or map title; for a list, what a site is called. */
  title: string;
  /** The layer or table ID in the service; null for a file. */
  layer: number | null;
  /** The fields the page reads, in the order the config names them. */
  fields: string[];
  /** Fields the page makes itself (an unpivoted x and y), so the source does not hold them. */
  virtualFields: string[];
  /** The where clause, when the config filters the layer. */
  where: string;
  /** For a file: where its numbers came from, when the config says. */
  upstream: string;
}

/** A layer of a service, or a file, and every use of it. */
export interface SourceLayer {
  /** "<source key>|<layer>" for a service layer, the source key for a file. */
  key: string;
  layer: number | null;
  uses: DataUse[];
}

export interface DataSource {
  /** The service URL or the file path, exactly as the config gives it. */
  key: string;
  kind: SourceKind;
  /** "Vegetation" for a service, "seral-stage-by-zone.json" for a file. */
  name: string;
  /** "MapServer", "FeatureServer", "JSON file", "CSV file", or "GeoJSON file". */
  type: string;
  /** Where the source is browsed: the service directory page, or the file. */
  href: string;
  layers: SourceLayer[];
  /** Every use across its layers. */
  useCount: number;
  programIds: number[];
}

/** One program's settings, as GET /dashboard-configs returns them. */
export interface ProgramConfig {
  MonitoringProgramID: number;
  DashboardConfig: DashboardConfig | null;
}

const SERVICE_PATTERN = /\/services\/((?:[^/]+\/)*[^/]+)\/(MapServer|FeatureServer)\/?$/;

/** "Vegetation" and "MapServer" from a service URL; folders stay in the name. */
export function parseService(url: string): { name: string; type: string } {
  const match = SERVICE_PATTERN.exec(url);
  return match ? { name: match[1], type: match[2] } : { name: url, type: 'Service' };
}

function fileType(path: string): string {
  if (/\.geojson$/i.test(path)) return 'GeoJSON file';
  if (/\.csv$/i.test(path)) return 'CSV file';
  return 'JSON file';
}

function fileName(path: string): string {
  return decodeURIComponent(path.split('?')[0].split('/').pop() || path);
}

const nonEmpty = (values: (string | undefined | null | false)[]): string[] => {
  const out: string[] = [];
  for (const v of values) if (v && !out.includes(v)) out.push(v);
  return out;
};

function measureFields(m: Measure): string[] {
  const ys = typeof m.y === 'string' ? [m.y] : (m.y ?? []).map((y) => y.field);
  return nonEmpty([m.x, ...ys, m.seriesBy, m.pick, m.standard?.field]);
}

interface Located {
  source: string;
  sourceKind: SourceKind;
  layer: number | null;
}

/** The config allows a layer ID as text ("17"); it is the same layer. */
const fromService = (service: string | undefined, layer: number | string | undefined): Located => {
  const id = typeof layer === 'string' && layer.trim() !== '' ? Number(layer) : layer;
  return { source: service || SERVICE, sourceKind: 'service', layer: typeof id === 'number' && Number.isFinite(id) ? id : null };
};

const fromFile = (path: string): Located => ({ source: path, sourceKind: 'file', layer: null });

/** Every use in one program's settings, each with the source it reads. */
export function programUses(programId: number, config: DashboardConfig | null): (DataUse & Located)[] {
  if (!config) return [];
  const out: (DataUse & Located)[] = [];
  const push = (where: Located, use: Omit<DataUse, 'programId' | 'layer'>) =>
    out.push({ ...where, ...use, programId, layer: where.layer });

  for (const m of config.measures ?? []) {
    const where = m.json ? fromFile(m.json) : m.csv ? fromFile(m.csv) : fromService(m.service, m.layer);
    push(where, {
      kind: 'chart',
      title: m.title,
      fields: measureFields(m),
      virtualFields: m.unpivot ? nonEmpty([m.x, typeof m.y === 'string' ? m.y : m.y?.[0]?.field]) : [],
      where: m.where ?? '',
      upstream: m.json || m.csv ? (m.sourceLabel ?? '') : '',
    });
  }

  const map = config.mapLayer;
  if (map) {
    push(map.url ? fromFile(map.url) : fromService(map.service, map.layer), {
      kind: 'map',
      title: map.title || 'Map',
      fields: nonEmpty([
        map.name,
        map.colorBy,
        map.pick,
        ...(map.fields ?? []).map((f) => f.field),
        ...(map.dotDensity?.fields ?? []).map((f) => f.field),
      ]),
      virtualFields: [],
      where: map.where ?? '',
      upstream: map.url ? (map.sourceLabel ?? '') : '',
    });
  }

  const sites = config.sitesLayer;
  if (sites) {
    push(fromService(sites.service, sites.layer), {
      kind: 'sites',
      title: `Monitoring ${sites.unit || 'site'}s`,
      fields: nonEmpty([sites.name, sites.code, sites.year, sites.first, sites.last, sites.status, sites.active]),
      virtualFields: [],
      where: sites.where ?? '',
      upstream: '',
    });
  }

  const perYear = config.sitesPerYear;
  if (perYear) {
    push(fromService(perYear.service, perYear.layer), {
      kind: 'sites-per-year',
      title: `${perYear.unit ? perYear.unit[0].toUpperCase() + perYear.unit.slice(1) : 'Site'}s monitored each year`,
      fields: nonEmpty([perYear.year, perYear.site]),
      virtualFields: [],
      where: perYear.where ?? '',
      upstream: '',
    });
  }

  for (const o of config.overlays ?? []) {
    push(fromService(o.service, o.layer), {
      kind: 'overlay',
      title: o.title,
      fields: nonEmpty([o.name, ...(o.fields ?? []).map((f) => f.field)]),
      virtualFields: [],
      where: o.where ?? '',
      upstream: '',
    });
  }

  // The profile's record layer is the program's sites or map layer unless it names another.
  const record = config.siteProfile?.record;
  if (record) {
    const home = sites ?? (map && !map.url ? map : undefined);
    push(fromService(home?.service, record.layer ?? home?.layer), {
      kind: 'profile',
      title: 'Site profile record',
      fields: nonEmpty([record.year, record.value, record.join?.to]),
      virtualFields: [],
      where: record.where ?? '',
      upstream: '',
    });
  }
  return out;
}

/**
 * Every source the programs read, most used first, each with its layers in ID order and the
 * uses of each layer in program order. A use whose service layer is missing (null) still lists.
 */
export function buildLineage(configs: ProgramConfig[]): DataSource[] {
  const sources = new Map<string, DataSource>();
  for (const { MonitoringProgramID: id, DashboardConfig: config } of configs) {
    for (const use of programUses(id, config)) {
      let source = sources.get(use.source);
      if (!source) {
        const named = use.sourceKind === 'file' ? { name: fileName(use.source), type: fileType(use.source) } : parseService(use.source);
        source = { key: use.source, kind: use.sourceKind, ...named, href: use.source, layers: [], useCount: 0, programIds: [] };
        sources.set(use.source, source);
      }
      const layerKey = use.sourceKind === 'file' ? use.source : `${use.source}|${use.layer}`;
      let layer = source.layers.find((l) => l.key === layerKey);
      if (!layer) {
        layer = { key: layerKey, layer: use.layer, uses: [] };
        source.layers.push(layer);
      }
      const { source: _s, sourceKind: _k, ...plain } = use;
      layer.uses.push(plain);
      source.useCount += 1;
      if (!source.programIds.includes(id)) source.programIds.push(id);
    }
  }
  const list = [...sources.values()];
  for (const s of list) s.layers.sort((a, b) => (a.layer ?? -1) - (b.layer ?? -1));
  // Two services can share a name (Vegetation MapServer and FeatureServer); say which is which.
  const names = new Map<string, number>();
  for (const s of list) names.set(s.name, (names.get(s.name) ?? 0) + 1);
  for (const s of list) if (names.get(s.name)! > 1) s.name = `${s.name} (${s.type})`;
  return list.sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name));
}

/** The service directory page of a layer, which also answers ?f=json with its name. */
export function layerHref(source: DataSource, layer: number | null): string {
  return source.kind === 'service' && layer !== null ? `${source.key}/${layer}` : source.href;
}

/** One row per use, for the inventory table and its CSV. */
export interface LineageRow extends Record<string, unknown> {
  source: string;
  sourceType: string;
  layer: string;
  use: string;
  title: string;
  programId: number;
  fields: string;
  where: string;
  upstream: string;
  href: string;
  /** The DataSource key, to look up a layer's name. */
  sourceKey: string;
}

export function lineageRows(sources: DataSource[]): LineageRow[] {
  const rows: LineageRow[] = [];
  for (const s of sources) {
    for (const l of s.layers) {
      for (const u of l.uses) {
        rows.push({
          source: s.name,
          sourceType: s.type,
          layer: l.layer === null ? '' : String(l.layer),
          use: USE_LABELS[u.kind],
          title: u.title,
          programId: u.programId,
          fields: u.fields.join(', '),
          where: u.where,
          upstream: u.upstream,
          href: layerHref(s, l.layer),
          sourceKey: s.key,
        });
      }
    }
  }
  return rows;
}
