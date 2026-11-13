import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  effect,
  inject,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

// The real Ecology Lit elements; this import registers esa-text-field and esa-button-toggle.
import '../../../ecology/ecology-elements.js';

import { LoadState, failed, ready } from '../../api/load-state';
import { MonitoringProgramSummary } from '../../api/models';
import { SandboxApiService } from '../../api/sandbox-api.service';
import { EsaBadge } from '../../ecology/esa-badge';
import { EsaButton } from '../../ecology/esa-button';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import { EsaStat } from '../../ecology/esa-stat';
import { csvFileName, toCsv } from '../../lib/csv';
import {
  DataSource,
  DataUse,
  USE_KEYS,
  USE_LABELS,
  UseKind,
  buildLineage,
  layerHref,
  lineageRows,
} from '../../lib/data-lineage';
import {
  CheckResult,
  INGEST_PATHS,
  IngestPath,
  LayerReport,
  PARTNER_PIPELINES,
  PathId,
  checkSource,
  classify,
  pathById,
  tally,
} from '../../lib/ingest';
import { SchemaDiagram } from './schema-diagram';

type EcologyChange = CustomEvent<{ value: string }>;
type View = 'diagram' | 'table';

interface Loaded {
  sources: DataSource[];
  programs: Map<number, MonitoringProgramSummary>;
}

/** A service layer's name, and whether it is a table, from the service directory. */
interface LayerInfo {
  name: string;
  table: boolean;
}

/** A service's layers by ID; 'loading' until it answers, null when it did not. */
type ServiceLayers = Map<number, LayerInfo> | 'loading' | null;

const TABLE_COLUMNS = [
  { field: 'source', headerName: 'Source' },
  { field: 'sourceType', headerName: 'Source type' },
  { field: 'layer', headerName: 'Layer' },
  { field: 'layerName', headerName: 'Layer name' },
  { field: 'use', headerName: 'Used as' },
  { field: 'title', headerName: 'Title' },
  { field: 'programId', headerName: 'Program ID' },
  { field: 'programName', headerName: 'Program' },
  { field: 'fields', headerName: 'Fields' },
  { field: 'where', headerName: 'Filter' },
  { field: 'upstream', headerName: 'Original source' },
  { field: 'href', headerName: 'URL' },
];

/**
 * The Data Model page: the six tables and how they join, then every chart, map, and site list
 * traced to the map service layer or data file it reads. Built from GET /dashboard-configs, so
 * it stays in step with the settings the program pages use.
 */
@Component({
  selector: 'app-data-model',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [RouterLink, SchemaDiagram, EsaBadge, EsaButton, EsaCard, EsaEmptyState, EsaStat],
  templateUrl: './data-model.html',
  styleUrl: './data-model.scss',
})
export class DataModel {
  private readonly api = inject(SandboxApiService);

  protected readonly state = signal<LoadState<Loaded>>({ status: 'loading' });
  protected readonly search = signal('');
  protected readonly view = signal<View>('diagram');
  private readonly picked = signal<string | null>(null);
  private readonly services = signal<Record<string, ServiceLayers>>({});

  /** Check reports by layer key, filled in as "Run checks" works through a source. */
  protected readonly reports = signal<Record<string, LayerReport>>({});
  /** The key of the source being checked, or null. */
  protected readonly checking = signal<string | null>(null);

  /** The partner data TRPA pulls and publishes, listed on the pipeline path's card. */
  protected readonly pipelines = PARTNER_PIPELINES;

  protected readonly useLabels = USE_LABELS;
  protected readonly useKeys = USE_KEYS;
  protected readonly viewOptions = [
    { label: 'Diagram', value: 'diagram' },
    { label: 'Table', value: 'table' },
  ];

  constructor() {
    forkJoin([this.api.getDashboardConfigs(), this.api.getPrograms()])
      .pipe(
        map(([configs, programs]) =>
          ready<Loaded>({
            sources: buildLineage(configs),
            programs: new Map(programs.map((p) => [p.MonitoringProgramID, p])),
          }),
        ),
        catchError((error: unknown) => of(failed<Loaded>(error))),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));

    // Name the layers on screen from the service directory, one request per service: the
    // picked service in the diagram, every service in the table. One at a time, because the
    // server refuses a burst.
    effect(() => {
      const shown = this.view() === 'table' ? this.all() : [this.selected()];
      const known = untracked(this.services);
      const wanted = shown.filter((s): s is DataSource => s?.kind === 'service' && !(s.key in known));
      if (!wanted.length) return;
      this.services.update((all) => ({ ...all, ...Object.fromEntries(wanted.map((s) => [s.key, 'loading' as const])) }));
      void (async () => {
        for (const source of wanted) {
          const layers = await fetchServiceLayers(source.key);
          this.services.update((all) => ({ ...all, [source.key]: layers }));
        }
      })();
    });
  }

  private readonly all = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data.sources : [];
  });

  protected readonly totals = computed(() => {
    const sources = this.all();
    const uses = sources.flatMap((s) => s.layers.flatMap((l) => l.uses));
    const count = (kinds: UseKind[]) => uses.filter((u) => kinds.includes(u.kind)).length;
    return {
      services: sources.filter((s) => s.kind === 'service').length,
      layers: sources.filter((s) => s.kind === 'service').reduce((n, s) => n + s.layers.length, 0),
      files: sources.filter((s) => s.kind === 'file').length,
      charts: count(['chart']),
      maps: count(['map', 'sites', 'overlay']),
    };
  });

  /** Each ingestion path with what comes in by it: layers or files, and the charts and maps on them. */
  protected readonly paths = computed(() => {
    const counts = new Map<PathId, { sources: number; uses: number }>();
    for (const s of this.all()) {
      for (const l of s.layers) {
        const id = classify(s, l.layer);
        const entry = counts.get(id) ?? { sources: 0, uses: 0 };
        entry.sources += 1;
        entry.uses += l.uses.length;
        counts.set(id, entry);
      }
    }
    return INGEST_PATHS.map((path) => ({
      path,
      auto: path.criteria.filter((c) => c.check),
      review: path.criteria.filter((c) => !c.check),
      ...(counts.get(path.id) ?? { sources: 0, uses: 0 }),
    }));
  });

  /** Passed and failed checks for the source on screen, once any have run. */
  protected readonly score = computed(() => {
    const source = this.selected();
    const full = this.all().find((s) => s.key === source?.key);
    const all = this.reports();
    const done = (full?.layers ?? []).map((l) => all[l.key]).filter(Boolean);
    return done.length ? { ...tally(done), layers: done.length, of: full!.layers.length } : null;
  });

  /** The sources with a use that matches the search; each keeps only its matching uses. */
  protected readonly filtered = computed<DataSource[]>(() => {
    const words = this.search().toLowerCase().split(/\s+/).filter(Boolean);
    const sources = this.all();
    if (!words.length) return sources;
    const programs = this.programs();
    const out: DataSource[] = [];
    for (const s of sources) {
      const layers = s.layers
        .map((l) => ({
          ...l,
          uses: l.uses.filter((u) => {
            const text = [
              s.name,
              this.info(s.key, l.layer)?.name,
              l.layer,
              USE_LABELS[u.kind],
              u.title,
              programs.get(u.programId)?.MonitoringProgramName,
              u.fields.join(' '),
              u.where,
            ]
              .join(' ')
              .toLowerCase();
            return words.every((w) => text.includes(w));
          }),
        }))
        .filter((l) => l.uses.length);
      if (layers.length) {
        const uses = layers.flatMap((l) => l.uses);
        out.push({
          ...s,
          layers,
          useCount: uses.length,
          programIds: [...new Set(uses.map((u) => u.programId))],
        });
      }
    }
    return out;
  });

  protected readonly selected = computed<DataSource | null>(() => {
    const list = this.filtered();
    return list.find((s) => s.key === this.picked()) ?? list[0] ?? null;
  });

  protected readonly serviceSources = computed(() => this.filtered().filter((s) => s.kind === 'service'));
  protected readonly fileSources = computed(() => this.filtered().filter((s) => s.kind === 'file'));

  private readonly programs = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.data.programs : new Map<number, MonitoringProgramSummary>();
  });

  protected readonly rows = computed(() => {
    const programs = this.programs();
    return lineageRows(this.filtered()).map((row) => {
      return {
        ...row,
        layerName: row.layer === '' ? '' : (this.info(row.sourceKey, Number(row.layer))?.name ?? ''),
        programName: programs.get(row.programId)?.MonitoringProgramName ?? '',
      };
    });
  });

  protected program(id: number): MonitoringProgramSummary | undefined {
    return this.programs().get(id);
  }

  /** A layer's name and kind once its service has answered. */
  protected info(service: string, layer: number | null): LayerInfo | undefined {
    const layers = this.services()[service];
    return layers instanceof Map && layer !== null ? layers.get(layer) : undefined;
  }

  /** True when the service answered and has no layer with this ID: a setting that points nowhere. */
  protected missing(service: string, layer: number | null): boolean {
    const layers = this.services()[service];
    return layers instanceof Map && layer !== null && !layers.has(layer);
  }

  protected href(source: DataSource, layer: number | null): string {
    return layerHref(source, layer);
  }

  protected pathOf(source: DataSource, layer: number | null): IngestPath {
    return pathById(classify(source, layer));
  }

  /** What the path card counts: layers for the service paths, files for the file path. */
  protected sourceNoun(path: IngestPath, n: number): string {
    const noun = path.id === 'file' ? 'file' : 'layer';
    return `${n} ${n === 1 ? noun : noun + 's'}`;
  }

  /** Runs the automated checks on every layer of the source on screen. */
  protected async runChecks(source: DataSource): Promise<void> {
    if (this.checking()) return;
    this.checking.set(source.key);
    // The full source, not the searched slice, so a report lines up with every use.
    const full = this.all().find((s) => s.key === source.key) ?? source;
    try {
      await checkSource(
        full,
        (url) => fetch(url),
        (key, report) => this.reports.update((all) => ({ ...all, [key]: report })),
      );
    } finally {
      this.checking.set(null);
    }
  }

  protected layerChecks(key: string): CheckResult[] {
    return this.reports()[key]?.layer ?? [];
  }

  /** A use's results. The report is in the full source's use order, so find the use there. */
  protected useChecks(source: DataSource, layerKey: string, use: DataUse): CheckResult[] {
    const report = this.reports()[layerKey];
    if (!report) return [];
    const full = this.all()
      .find((s) => s.key === source.key)
      ?.layers.find((l) => l.key === layerKey);
    const index = full?.uses.indexOf(use) ?? -1;
    return index >= 0 ? (report.uses[index] ?? []) : [];
  }

  protected checkVariant(c: CheckResult): 'success' | 'danger' | 'neutral' {
    return c.status === 'pass' ? 'success' : c.status === 'fail' ? 'danger' : 'neutral';
  }

  protected pick(source: DataSource): void {
    this.picked.set(source.key);
  }

  protected onSearch(event: Event): void {
    this.search.set((event as EcologyChange).detail.value ?? '');
  }

  protected onView(event: Event): void {
    const value = (event as EcologyChange).detail.value;
    if (value === 'diagram' || value === 'table') this.view.set(value);
  }

  protected useCountText(n: number): string {
    return `${n} ${n === 1 ? 'use' : 'uses'}`;
  }

  protected trackUse(u: DataUse, i: number): string {
    return `${u.programId}|${u.kind}|${u.title}|${i}`;
  }

  /** A CSV of exactly the rows the table shows. */
  protected downloadCsv(): void {
    const text = toCsv(TABLE_COLUMNS, this.rows());
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFileName(['monitoring dashboard data sources', this.search()]);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

/** Every layer and table of a service, by ID, from the ArcGIS service directory (?f=json). */
async function fetchServiceLayers(service: string): Promise<Map<number, LayerInfo> | null> {
  interface Entry {
    id: number;
    name: string;
  }
  try {
    const response = await fetch(`${service}?f=json`);
    if (!response.ok) return null;
    const json = (await response.json()) as { layers?: Entry[]; tables?: Entry[]; error?: unknown } | null;
    if (!json || json.error || !json.layers) return null;
    const out = new Map<number, LayerInfo>();
    for (const l of json.layers) out.set(l.id, { name: l.name, table: false });
    for (const t of json.tables ?? []) out.set(t.id, { name: t.name, table: true });
    return out;
  } catch {
    return null;
  }
}
