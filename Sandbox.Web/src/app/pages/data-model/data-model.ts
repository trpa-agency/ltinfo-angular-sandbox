import { HttpClient } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of } from 'rxjs';

import { EsaButton } from '../../ecology/esa-button';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import { CsvColumn, csvFileName, toCsv } from '../../lib/csv';
import { bindingCoverage, bindingNeeds } from '../../lib/ltinfo-model/bindings';
import {
  CheckResult,
  INGEST_PATHS,
  IngestPath,
  LayerReport,
  NATIVE_SOURCES,
  PARTNER_PIPELINES,
  checkSource,
  classify,
  pathById,
  tally,
} from '../../lib/ltinfo-model/ingest';
import { DataSource, PlannedSources, PlannedUse, USE_LABELS, buildLineage, layerHref } from '../../lib/ltinfo-model/lineage';
import type { MonitoringNewDataModel, MonitoringNewProgramGridRow } from '../../lib/ltinfo-model/ltinfo-dto';
import { buildRegister, pathCounts } from '../../lib/ltinfo-model/register';
import { Breadcrumb, Crumb } from '../../shared/breadcrumb';
import { SchemaDiagram } from './schema-diagram';

type Loaded =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; programs: MonitoringNewProgramGridRow[]; dataModel: MonitoringNewDataModel; planned: PlannedSources; snapshot: Snapshot };

type RegisterView = 'programs' | 'charts' | 'indicators' | 'scheduled';

/** When the LT Info snapshot was taken, and from where. */
interface Snapshot {
  takenOn: string;
  source: string;
}

/** A column of a register table. `link` makes the cell a link: to a program page, or to an outside address. */
interface RegisterColumn extends CsvColumn {
  link?: { kind: 'program'; idField: string } | { kind: 'href'; hrefField: string };
  numeric?: boolean;
}

/** A service layer's name, and whether it is a table, from the service directory. */
interface LayerInfo {
  name: string;
  table: boolean;
}

/** A service's layers by ID; 'loading' until it answers, null when it did not. */
type ServiceLayers = Map<number, LayerInfo> | 'loading' | null;

// A snapshot of LT Info's GET monitoring-new/programs and monitoring-new/data-model, and the planned
// charts and maps LT Info's page reads from its assets. Refresh with tools/snapshot-ltinfo-data-model.sh.
const SNAPSHOT = 'data/ltinfo/';

/**
 * The Data Model page, ported from LT Info's Monitoring Dashboard redesign
 * (esassoc/ltinfo, LtInfo.Web/src/app/areas/monitoring-new/data-model) so it can be read without
 * an LT Info login. It states the rule (every chart is an indicator in LT Info whose numbers come
 * from a map service, with transit ridership and stormwater load reductions read from LT Info
 * itself), shows the tables that would carry it, lists the ways data may come in and what each must
 * meet, and keeps the register: every planned chart, program, and indicator with the next step.
 *
 * The logic in lib/ltinfo-model is LT Info's, copied unchanged apart from import paths. The page
 * reads a snapshot of LT Info's responses rather than the sandbox's own seed, so the counts match
 * LT Info's.
 */
@Component({
  selector: 'app-data-model',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [Breadcrumb, RouterLink, SchemaDiagram, EsaButton, EsaCard, EsaEmptyState],
  templateUrl: './data-model.html',
  styleUrl: './data-model.scss',
})
export class DataModel {
  private readonly http = inject(HttpClient);

  /** The page is reached from About Monitoring on the home page. */
  protected readonly trail: readonly Crumb[] = [
    { label: 'Monitoring Programs', link: ['/'] },
    { label: 'About Monitoring', link: ['/'], fragment: 'about' },
    { label: 'Data Model' },
  ];

  /** LT Info's programs and indicators with the planned charts and maps; one state for the page. */
  protected readonly loaded = toSignal(
    forkJoin({
      programs: this.http.get<MonitoringNewProgramGridRow[]>(`${SNAPSHOT}monitoring-new-programs.json`),
      dataModel: this.http.get<MonitoringNewDataModel>(`${SNAPSHOT}monitoring-new-data-model.json`),
      planned: this.http.get<PlannedSources>(`${SNAPSHOT}planned-sources.json`),
      snapshot: this.http.get<Snapshot>(`${SNAPSHOT}snapshot.json`),
    }).pipe(
      map((result): Loaded => ({ status: 'ready', ...result })),
      catchError(() => of<Loaded>({ status: 'error' })),
    ),
    { initialValue: { status: 'loading' } as Loaded },
  );

  protected readonly register = computed(() => {
    const loaded = this.loaded();
    return loaded.status === 'ready' ? buildRegister(loaded.programs, loaded.dataModel, loaded.planned) : null;
  });

  protected readonly snapshot = computed(() => {
    const loaded = this.loaded();
    return loaded.status === 'ready' ? loaded.snapshot : null;
  });

  private readonly planned = computed(() => {
    const loaded = this.loaded();
    return loaded.status === 'ready' ? loaded.planned : null;
  });

  /** The header totals. */
  protected readonly totals = computed(() => {
    const totals = this.register()?.totals;
    if (!totals) {
      return [];
    }
    return [
      { label: 'planned charts', value: totals.plannedCharts },
      { label: 'read a map service', value: totals.chartsOnServices },
      { label: 'ready to bind to an indicator', value: totals.chartsReadyToBind },
      { label: 'indicators bound to a layer', value: totals.boundIndicators },
    ];
  });

  // ---------- The proposed tables ----------

  /** Every kind of planned use with the proposed table that would hold it. */
  protected readonly coverage = computed(() => bindingCoverage(this.planned()?.Uses ?? []));

  /** What the planned uses ask of the proposed tables; null until the plan has loaded. */
  protected readonly needs = computed(() => {
    const planned = this.planned();
    return planned ? bindingNeeds(planned.Uses) : null;
  });

  // ---------- Ingestion paths ----------

  protected readonly pipelines = PARTNER_PIPELINES;
  /** The readers the LT Info Native Data path names, listed on its card. */
  protected readonly nativeSources = NATIVE_SOURCES;

  /** Each path with what comes in by it today, and its criteria split by who checks them. */
  protected readonly paths = computed(() => {
    const planned = this.planned();
    const counts = planned ? pathCounts(planned) : {};
    return INGEST_PATHS.map((path) => ({
      path,
      auto: path.criteria.filter((criterion) => criterion.check),
      review: path.criteria.filter((criterion) => !criterion.check),
      sources: counts[path.id]?.sources ?? 0,
      uses: counts[path.id]?.uses ?? 0,
    }));
  });

  protected pathFlag(path: IngestPath): string {
    switch (path.forIndicators) {
      case 'yes':
        return 'Accepted for indicators';
      case 'native':
        return 'Transit ridership and stormwater only';
      case 'interim':
        return 'Interim only';
      default:
        return 'Program records, not measurements';
    }
  }

  /** What the path card counts: layers for the service paths, files for the file path. */
  protected sourceNoun(path: IngestPath, count: number): string {
    const noun = path.id === 'file' ? 'file' : 'layer';
    return `${count.toLocaleString('en-US')} ${count === 1 ? noun : noun + 's'}`;
  }

  protected useCountText(count: number): string {
    return `${count.toLocaleString('en-US')} ${count === 1 ? 'use' : 'uses'}`;
  }

  // ---------- The register ----------

  protected readonly view = signal<RegisterView>('programs');

  protected readonly views: { key: RegisterView; label: string }[] = [
    { key: 'programs', label: 'Programs' },
    { key: 'charts', label: 'Planned Charts' },
    { key: 'indicators', label: 'Indicators' },
    { key: 'scheduled', label: 'Scheduled Sources' },
  ];

  protected viewCount(view: RegisterView): number {
    return this.registerRows(view).length;
  }

  private readonly columns: Record<RegisterView, RegisterColumn[]> = {
    programs: [
      { field: 'ProgramName', headerName: 'Program', link: { kind: 'program', idField: 'ProgramLinkID' } },
      { field: 'NextStepLabel', headerName: 'Next Step' },
      { field: 'InLtInfo', headerName: 'In LT Info?' },
      { field: 'CategoryName', headerName: 'Category' },
      { field: 'IndicatorCount', headerName: 'Indicators', numeric: true },
      { field: 'PlannedCharts', headerName: 'Planned Charts', numeric: true },
      { field: 'ChartsOnServices', headerName: 'On a Map Service', numeric: true },
      { field: 'ChartsOnFiles', headerName: 'On a File', numeric: true },
      { field: 'ScheduledSources', headerName: 'Scheduled Sources', numeric: true },
      { field: 'IndicatorNames', headerName: 'Linked Indicators' },
      { field: 'SuggestedIndicators', headerName: 'Possible Indicators (by Name)' },
      { field: 'PlannedName', headerName: 'Planned Name' },
    ],
    charts: [
      { field: 'Title', headerName: 'Chart' },
      { field: 'ProgramName', headerName: 'Program', link: { kind: 'program', idField: 'ProgramLinkID' } },
      { field: 'NextStepLabel', headerName: 'Next Step' },
      { field: 'PathLabel', headerName: 'Path' },
      { field: 'SourceName', headerName: 'Source', link: { kind: 'href', hrefField: 'LayerHref' } },
      { field: 'Layer', headerName: 'Layer' },
      { field: 'Fields', headerName: 'Fields' },
      { field: 'Where', headerName: 'Filter' },
      { field: 'IndicatorCount', headerName: 'Indicators on the Program', numeric: true },
      { field: 'IndicatorNames', headerName: 'Indicator Names' },
      { field: 'CategoryName', headerName: 'Category' },
      { field: 'Upstream', headerName: 'Original Source' },
    ],
    indicators: [
      { field: 'IndicatorDisplayName', headerName: 'Indicator' },
      { field: 'TodayLabel', headerName: 'Numbers Today' },
      { field: 'ProgramCount', headerName: 'Programs', numeric: true },
      { field: 'PlannedCharts', headerName: 'Planned Charts on Its Programs', numeric: true },
      { field: 'ReportedValueCount', headerName: 'Stored Values', numeric: true },
      { field: 'ChartSourceURL', headerName: 'Embedded Chart Page', link: { kind: 'href', hrefField: 'ChartSourceURL' } },
      { field: 'IndicatorTypeDisplayName', headerName: 'Type' },
      { field: 'MeasurementUnitTypeDisplayName', headerName: 'Unit' },
      { field: 'DataSourceType', headerName: 'Data Source Type' },
      { field: 'Dashboards', headerName: 'Other Dashboards' },
      { field: 'ProgramNames', headerName: 'Program Names' },
    ],
    scheduled: [
      { field: 'MonitoringDataSourceName', headerName: 'Source' },
      { field: 'Kind', headerName: 'Kind' },
      { field: 'ProgramName', headerName: 'Program', link: { kind: 'program', idField: 'MonitoringProgramID' } },
      { field: 'LastRunDate', headerName: 'Last Run' },
      { field: 'LastRunStatus', headerName: 'Last Run Result' },
      { field: 'LastChangeDate', headerName: 'Last Changed Data' },
      { field: 'MonitoringDataSourceLocation', headerName: 'Address', link: { kind: 'href', hrefField: 'MonitoringDataSourceLocation' } },
    ],
  };

  protected readonly viewColumns = computed(() => this.columns[this.view()]);

  protected readonly viewRows = computed(() => this.registerRows(this.view()));

  private registerRows(view: RegisterView): Record<string, unknown>[] {
    const register = this.register();
    if (!register) {
      return [];
    }
    const rows = { programs: register.programs, charts: register.charts, indicators: register.indicators, scheduled: register.scheduledSources }[view];
    return rows as unknown as Record<string, unknown>[];
  }

  /** A cell as text: yes or no for a flag, a short date for a timestamp, a list joined by commas. */
  protected cellText(row: Record<string, unknown>, column: RegisterColumn): string {
    const value = row[column.field];
    if (value === null || value === undefined) {
      return '';
    }
    if (typeof value === 'boolean') {
      return value ? 'Yes' : 'No';
    }
    if (typeof value === 'number') {
      return value.toLocaleString('en-US');
    }
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    if (column.field.endsWith('Date') && typeof value === 'string') {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
    }
    return String(value);
  }

  /** The program a cell links to, when that program has a page here. */
  protected programLink(row: Record<string, unknown>, column: RegisterColumn): number | null {
    if (column.link?.kind !== 'program') {
      return null;
    }
    const id = row[column.link.idField];
    return typeof id === 'number' ? id : null;
  }

  protected hrefOf(row: Record<string, unknown>, column: RegisterColumn): string | null {
    if (column.link?.kind !== 'href') {
      return null;
    }
    const href = row[column.link.hrefField];
    return typeof href === 'string' && href ? href : null;
  }

  protected downloadCsv(): void {
    const view = this.view();
    const columns = this.columns[view].map(({ field, headerName }) => ({ field, headerName }));
    const rows = this.registerRows(view).map((row) => {
      const out: Record<string, unknown> = {};
      for (const column of this.columns[view]) {
        out[column.field] = this.cellText(row, column);
      }
      return out;
    });
    const url = URL.createObjectURL(new Blob([toCsv(columns, rows)], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = csvFileName(['monitoring data model', this.views.find((option) => option.key === view)?.label]);
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // ---------- Sources and checks ----------

  protected readonly useLabels = USE_LABELS;

  protected readonly sourceSearch = signal('');

  private readonly allSources = computed(() => buildLineage(this.planned()?.Uses ?? []));

  protected readonly sourceTotals = computed(() => {
    const sources = this.allSources();
    const services = sources.filter((source) => source.kind === 'service');
    return {
      services: services.length,
      layers: services.reduce((sum, source) => sum + source.layers.length, 0),
      files: sources.filter((source) => source.kind === 'file').length,
      uses: sources.reduce((sum, source) => sum + source.useCount, 0),
    };
  });

  /** The sources with a use that matches the search; each keeps only its matching layers and uses. */
  protected readonly sources = computed<DataSource[]>(() => {
    const words = this.sourceSearch().toLowerCase().split(/\s+/).filter(Boolean);
    const sources = this.allSources();
    if (!words.length) {
      return sources;
    }
    const out: DataSource[] = [];
    for (const source of sources) {
      const layers = source.layers
        .map((layer) => ({
          ...layer,
          uses: layer.uses.filter((use) => {
            const text = [source.name, layer.layer, USE_LABELS[use.Kind], use.Title, this.programName(use.MonitoringProgramID), use.Fields.join(' '), use.Where]
              .join(' ')
              .toLowerCase();
            return words.every((word) => text.includes(word));
          }),
        }))
        .filter((layer) => layer.uses.length);
      if (layers.length) {
        const uses = layers.flatMap((layer) => layer.uses);
        out.push({ ...source, layers, useCount: uses.length, programIDs: [...new Set(uses.map((use) => use.MonitoringProgramID))] });
      }
    }
    return out;
  });

  protected readonly serviceSources = computed(() => this.sources().filter((source) => source.kind === 'service'));
  protected readonly fileSources = computed(() => this.sources().filter((source) => source.kind === 'file'));

  /** Layer names by service, filled in when a service is opened. */
  private readonly services = signal<Record<string, ServiceLayers>>({});
  /** Check reports by layer key, filled in as Run Checks works through a source. */
  private readonly reports = signal<Record<string, LayerReport>>({});
  /** The key of the source being checked, or null. */
  protected readonly checking = signal<string | null>(null);

  private readonly programNames = computed(() => {
    const names = new Map<number, { name: string; inLtInfo: boolean }>();
    for (const program of this.register()?.programs ?? []) {
      names.set(program.MonitoringProgramID, { name: program.ProgramName, inLtInfo: program.InLtInfo });
    }
    return names;
  });

  protected onSourceSearch(event: Event): void {
    this.sourceSearch.set((event.target as HTMLInputElement).value);
  }

  protected programName(programID: number): string {
    return this.programNames().get(programID)?.name ?? `Program ${programID}`;
  }

  protected programInLtInfo(programID: number): boolean {
    return this.programNames().get(programID)?.inLtInfo ?? false;
  }

  protected pathOf(source: DataSource, layer: number | null): IngestPath {
    return pathById(classify(source, layer));
  }

  protected href(source: DataSource, layer: number | null): string {
    return layerHref(source, layer);
  }

  /** A layer's name and kind once its service has answered. */
  protected layerInfo(source: DataSource, layer: number | null): LayerInfo | undefined {
    const layers = this.services()[source.key];
    return layers instanceof Map && layer !== null ? layers.get(layer) : undefined;
  }

  /** True when the service answered and has no layer with this ID: a setting that points nowhere. */
  protected layerMissing(source: DataSource, layer: number | null): boolean {
    const layers = this.services()[source.key];
    return layers instanceof Map && layer !== null && !layers.has(layer);
  }

  /** Names a service's layers the first time it is opened: one request to the service directory. */
  protected onSourceToggle(event: Event, source: DataSource): void {
    if (!(event.target as HTMLDetailsElement).open || source.kind !== 'service' || source.key in this.services()) {
      return;
    }
    this.services.update((all) => ({ ...all, [source.key]: 'loading' }));
    void fetchServiceLayers(source.key).then((layers) => this.services.update((all) => ({ ...all, [source.key]: layers })));
  }

  /** Runs the automated checks on every layer of a source. */
  protected async runChecks(source: DataSource): Promise<void> {
    if (this.checking()) {
      return;
    }
    this.checking.set(source.key);
    // The full source, not the searched slice, so a report lines up with every use of a layer.
    const full = this.allSources().find((item) => item.key === source.key) ?? source;
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

  protected layerChecks(layerKey: string): CheckResult[] {
    return this.reports()[layerKey]?.layer ?? [];
  }

  /** A use's results. The report is in the full source's use order, so find the use there. */
  protected useChecks(source: DataSource, layerKey: string, use: PlannedUse): CheckResult[] {
    const report = this.reports()[layerKey];
    if (!report) {
      return [];
    }
    const full = this.allSources()
      .find((item) => item.key === source.key)
      ?.layers.find((layer) => layer.key === layerKey);
    const index = full?.uses.indexOf(use) ?? -1;
    return index >= 0 ? (report.uses[index] ?? []) : [];
  }

  /** Passed and failed checks for a source, once any have run. */
  protected score(source: DataSource): { pass: number; fail: number } | null {
    const full = this.allSources().find((item) => item.key === source.key);
    const all = this.reports();
    const done = (full?.layers ?? []).map((layer) => all[layer.key]).filter(Boolean);
    return done.length ? tally(done) : null;
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
    if (!response.ok) {
      return null;
    }
    const json = (await response.json()) as { layers?: Entry[]; tables?: Entry[]; error?: unknown } | null;
    if (!json || json.error || !json.layers) {
      return null;
    }
    const out = new Map<number, LayerInfo>();
    for (const layer of json.layers) {
      out.set(layer.id, { name: layer.name, table: false });
    }
    for (const table of json.tables ?? []) {
      out.set(table.id, { name: table.name, table: true });
    }
    return out;
  } catch {
    return null;
  }
}
