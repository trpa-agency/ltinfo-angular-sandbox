import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of } from 'rxjs';

import { LoadState, failed, ready } from '../../api/load-state';
import { MonitoringProgramDetail } from '../../api/models';
import { SandboxApiService } from '../../api/sandbox-api.service';
import { EsaBadge, EsaBadgeVariant } from '../../ecology/esa-badge';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import type { Measure, PanelSource } from '../../lib/measures';
import { sitesPerYearMeasure } from '../../lib/measures';
import type { PanelState } from '../../lib/sites';
import { ChartPanel, ChartPanelData } from './chart-panel';

/** One panel on the test page: a real measure, and the chart shape it is here to show. */
interface DemoCase {
  key: string;
  /** The shape under test, shown over the panel. */
  shape: string;
  /** What to look for. */
  note: string;
  program: string;
  measure: Measure;
  source: PanelSource | null;
  /** Full width, or half so two panels sit side by side on a wide screen. */
  wide: boolean;
}

/** What a panel has reported through its outputs, shown under it. */
interface Report {
  state: PanelState;
  shown: number | null;
  loaded: number | null;
  picked: string | null;
  events: number;
}

/** Which measures to show: program id, index in DashboardConfig.measures, and the shape. */
const PICKS: { id: number; index: number; shape: string; note: string; wide?: boolean }[] = [
  {
    id: 41,
    index: 0,
    shape: 'Lines, several series, a pick, and a threshold',
    note: 'Year axis. Each station has its own color, point shape, and dash. Change the statistic: the chart, the table, and the CSV follow.',
    wide: true,
  },
  {
    id: 41,
    index: 1,
    shape: 'Lines on a date axis, about 10,000 rows',
    note: 'A daily record. Lines are solid with a shape every so often, and the date axis keeps a few ticks.',
    wide: true,
  },
  {
    id: 12,
    index: 0,
    shape: 'Lines from wide year columns (unpivot)',
    note: 'Ten short series: the dash patterns and shapes carry what color alone cannot.',
  },
  { id: 39, index: 1, shape: 'One line, value axis not from zero', note: 'zero: false. One series, so no legend.' },
  { id: 63, index: 0, shape: 'Grouped bars on a category axis', note: 'Text periods such as 2016-2019 on the x axis.' },
  {
    id: 63,
    index: 1,
    shape: 'Stacked bars, shares as percents',
    note: 'format: .0% on the axis, the tooltip, and the table. The axis stops at 100 percent.',
  },
  {
    id: 33,
    index: 0,
    shape: 'Ranked horizontal bars',
    note: 'orientation: h with sort and limit: the 15 busiest counters, longest bar first.',
  },
  { id: 14, index: 0, shape: 'Stacked horizontal bars', note: 'Two y fields stacked along each bar, ranked by the first.' },
  { id: 33, index: 1, shape: 'Bars on a month axis', note: 'Month numbers shown as month names.' },
  {
    id: 64,
    index: 0,
    shape: 'One bar series with a threshold',
    note: 'The threshold is a dashed rule with its label at the right end. Years with no count leave a gap.',
  },
  { id: 63, index: 2, shape: 'Bars from a server statistic, with a pick', note: 'stat: avg grouped by year and site type.' },
];

const PROGRAM_IDS = [...new Set(PICKS.map((p) => p.id))];

function demoCases(programs: MonitoringProgramDetail[]): DemoCase[] {
  const byId = new Map(programs.map((p) => [p.MonitoringProgramID, p]));
  const cases: DemoCase[] = [];
  for (const pick of PICKS) {
    const program = byId.get(pick.id);
    const measure = program?.DashboardConfig?.measures?.[pick.index];
    if (!program || !measure) continue;
    cases.push({
      key: `${pick.id}-${pick.index}`,
      shape: pick.shape,
      note: pick.note,
      program: program.MonitoringProgramName,
      // The page decides the width here, not the measure's span.
      measure,
      source: null,
      wide: !!pick.wide,
    });
  }

  // Sites monitored each year: the rows come from the source, not from the measure's own query.
  const ozone = byId.get(41);
  const perYear = ozone?.DashboardConfig?.sitesPerYear;
  if (ozone && perYear) {
    cases.push({
      key: '41-sites-per-year',
      shape: 'Sites monitored each year, through source',
      note: 'A distinct count of stations per year, drawn with the same panel.',
      program: ozone.MonitoringProgramName,
      measure: sitesPerYearMeasure(perYear),
      source: { kind: 'sites-per-year', config: perYear },
      wide: false,
    });
  }

  // Two deliberate cases, both from a real measure.
  const traffic = byId.get(64);
  const base = traffic?.DashboardConfig?.measures?.[0];
  if (traffic && base) {
    cases.push({
      key: 'empty',
      shape: 'Empty state',
      note: 'The same measure with where set to 1=0: no rows, so no tools.',
      program: traffic.MonitoringProgramName,
      measure: { ...base, title: 'Winter traffic volume, no rows', where: '1=0' },
      source: null,
      wide: false,
    });
    cases.push({
      key: 'error',
      shape: 'Error state',
      note: 'The same measure pointed at layer 9999, which does not exist. One console warning that names the layer is expected.',
      program: traffic.MonitoringProgramName,
      measure: { ...base, title: 'Winter traffic volume, missing layer', layer: 9999 },
      source: null,
      wide: false,
    });
  }
  return cases;
}

const STATE_VARIANT: Record<PanelState, EsaBadgeVariant> = {
  loading: 'neutral',
  ready: 'success',
  empty: 'warning',
  error: 'danger',
};

// The test page at /dev/charts: every chart shape the panel supports, each from a real
// measure of a seeded program, plus the empty and error states. Under each panel is
// what the panel reported through its loaded and settled outputs.
@Component({
  selector: 'app-chart-panel-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartPanel, EsaBadge, EsaCard, EsaEmptyState],
  templateUrl: './chart-panel-demo.html',
  styleUrl: './chart-panel-demo.scss',
})
export class ChartPanelDemo {
  private readonly api = inject(SandboxApiService);

  protected readonly state = signal<LoadState<DemoCase[]>>({ status: 'loading' });
  protected readonly reports = signal<Record<string, Report>>({});
  protected readonly variants = STATE_VARIANT;

  constructor() {
    forkJoin(PROGRAM_IDS.map((id) => this.api.getProgram(id)))
      .pipe(
        map((programs) => ready(demoCases(programs))),
        catchError((error: unknown) => of(failed<DemoCase[]>(error))),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));
  }

  protected report(key: string): Report {
    return this.reports()[key] ?? { state: 'loading', shown: null, loaded: null, picked: null, events: 0 };
  }

  protected onLoaded(key: string, data: ChartPanelData): void {
    const now = this.report(key);
    this.reports.update((all) => ({
      ...all,
      [key]: {
        ...now,
        shown: data.rows.length,
        loaded: data.allRows?.length ?? data.rows.length,
        picked: data.picked ?? null,
        events: now.events + 1,
      },
    }));
  }

  protected onSettled(key: string, state: PanelState): void {
    this.reports.update((all) => ({ ...all, [key]: { ...this.report(key), state } }));
  }
}
