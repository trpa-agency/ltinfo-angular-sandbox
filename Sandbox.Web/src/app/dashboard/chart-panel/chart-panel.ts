import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import type { Result } from 'vega-embed';

// The real Ecology Lit elements: esa-select for the pick and esa-button-toggle for
// Chart or Table. Imported once, for its side effect.
import '../../../ecology/ecology-elements.js';

import { EsaButton } from '../../ecology/esa-button';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import { formatValue } from '../../lib/chart/format';
import { csvFileName, toCsv } from '../../lib/csv';
import type { Attributes } from '../../lib/map-service';
import { layerUrl } from '../../lib/map-service';
import type { Measure, PanelSource } from '../../lib/measures';
import {
  ERROR_STATE,
  defaultPick,
  emptyStateText,
  measureChartSpec,
  measureColumns,
  measureView,
  pickChoices,
  pickedRows,
  queryPanelRows,
} from '../../lib/measures';
import type { PanelState } from '../../lib/sites';
import type { VegaTheme } from '../../lib/vega-spec';
import {
  DEFAULT_VEGA_THEME,
  TOOLTIP_LABEL_FIELD,
  chartDescription,
  seriesStyle,
  tooltipValueField,
  vegaLiteSpec,
} from '../../lib/vega-spec';

/** What a chart panel reports once its rows have arrived. */
export interface ChartPanelData {
  measure: Measure;
  /** The rows on the chart, in the table, and in the CSV: the picked value's rows, sorted and capped. */
  rows: Attributes[];
  /** Every row loaded for the measure, before the pick. Use this for record spans. */
  allRows?: Attributes[];
  /** The picked value, when the measure has a pick. */
  picked?: string;
}

type View = 'chart' | 'table';

interface Option {
  label: string;
  value: string;
}

/** The detail every Ecology form element sends with its "change" event. */
type EcologyChange = CustomEvent<{ value?: string | string[] }>;

interface TooltipRow {
  name: string;
  value: string;
  color: string;
  /** SVG path of the series shape, in a 12 by 12 box centered on 0,0. */
  path: string;
}

interface Tooltip {
  title: string;
  rows: TooltipRow[];
  /** The pointer position in the window, in CSS pixels. */
  left: number;
  top: number;
  /** Drawn to the left of the pointer, near the right edge of the window. */
  flip: boolean;
  /** Drawn above the pointer, near the bottom edge of the window. */
  above: boolean;
}

/** The point shapes of vega-spec.ts as paths, so a tooltip row shows the same shape as its line. */
const SHAPE_PATHS: Record<string, string> = {
  circle: 'M-5,0a5,5 0 1,0 10,0a5,5 0 1,0 -10,0',
  square: 'M-4.5,-4.5h9v9h-9z',
  'triangle-up': 'M0,-5.2L5.4,4.2H-5.4z',
  diamond: 'M0,-5.8L5.8,0L0,5.8L-5.8,0z',
  'triangle-down': 'M0,5.2L5.4,-4.2H-5.4z',
};

/** CSS custom properties the chart theme is read from, with the LT Info values as fallbacks. */
const SERIES_TOKENS = [1, 2, 3, 4, 5, 6, 7, 8].map((n) => `--color-background-dataviz-categorical-${n}`);

let nextId = 0;

/**
 * Resolves once the chart font is usable, or after a short wait. Vega sizes axes and
 * legends from measured text, so a chart drawn before the web font arrives would leave
 * too little room for its labels.
 */
const fontsWaited = new Map<string, Promise<void>>();
function fontReady(theme: VegaTheme): Promise<void> {
  const key = `${theme.fontSize}px ${theme.fontFamily}`;
  let wait = fontsWaited.get(key);
  if (!wait) {
    const loads = Promise.all([document.fonts.load(key), document.fonts.load(`500 ${key}`)]).then(
      () => undefined,
      () => undefined,
    );
    wait = Promise.race([loads, new Promise<void>((resolve) => setTimeout(resolve, 1500))]);
    fontsWaited.set(key, wait);
  }
  return wait;
}

/*
 * The measurement panel: one measure from a program's DashboardConfig.measures, drawn
 * as a Vega-Lite chart with a table view and a CSV download of the same rows.
 *
 * Ported from mon-chart-panel in the LT Info Monitoring Dashboard repo. The chart
 * itself is a Vega-Lite spec built by lib/vega-spec.ts and drawn by vega-embed, which
 * is loaded on demand so pages without a chart do not carry it.
 *
 * Contract: the inputs and outputs below, and data-state on the host. The host reads
 * loading until the first chart is drawn, then ready, empty, or error.
 */
@Component({
  selector: 'app-chart-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Contract: the host element always carries data-state = loading | ready | empty | error.
  host: { '[attr.data-state]': 'state()', '[attr.data-rows]': 'state() === "ready" ? rows().length : null' },
  // esa-select and esa-button-toggle are Lit elements, which Angular does not know.
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [EsaButton, EsaCard, EsaEmptyState],
  templateUrl: './chart-panel.html',
  styleUrl: './chart-panel.scss',
})
export class ChartPanel {
  /** One measure from the program's DashboardConfig.measures. */
  readonly measure = input.required<Measure>();
  /** Program name, used in the CSV file name. */
  readonly programName = input.required<string>();
  /** Set for the "sites monitored each year" chart; null for an ordinary measure. */
  readonly source = input<PanelSource | null>(null);
  /** Overrides the empty-state wording. */
  readonly emptyText = input<{ title: string; description: string } | null>(null);

  /** Fires each time rows are loaded (first load and after a pick change). */
  readonly loaded = output<ChartPanelData>();
  /** Fires when the panel reaches ready, empty, or error. */
  readonly settled = output<PanelState>();

  /** loading, ready, empty, or error; mirrored to data-state on the host. */
  protected readonly state = signal<PanelState>('loading');
  /** The rows have arrived and there is something to show; the chart may still be drawing. */
  protected readonly hasData = signal(false);
  protected readonly view = signal<View>('chart');
  protected readonly picked = signal<string | undefined>(undefined);
  protected readonly tooltip = signal<Tooltip | null>(null);

  protected readonly errorText = ERROR_STATE;
  protected readonly viewOptions: Option[] = [
    { label: 'Chart', value: 'chart' },
    { label: 'Table', value: 'table' },
  ];
  protected readonly descriptionId = `chart-panel-desc-${(nextId += 1)}`;

  // A parent that rebuilds the measure object on every render (sitesPerYearMeasure(cfg)
  // in a template, say) must not start a new request each time, so the inputs are
  // compared by content.
  private readonly request = computed(() => JSON.stringify([this.measure(), this.source()]));
  /** The measure the current rows were asked for. */
  protected readonly current = computed<Measure>(() => {
    this.request();
    return untracked(this.measure);
  });

  /** Every row loaded, before the pick. */
  private readonly all = signal<Attributes[]>([]);
  protected readonly choices = computed(() => pickChoices(this.current(), this.all()));
  protected readonly pickOptions = computed<Option[]>(() => this.choices().map((c) => ({ label: c, value: c })));
  /** The rows shown: the picked value's rows, sorted and capped by the measure. */
  protected readonly rows = computed(() => {
    const m = this.current();
    return measureView(m, pickedRows(m, this.all(), this.picked()));
  });
  protected readonly columns = computed(() => measureColumns(this.current()));
  /** Table cells as text, built once per row set. */
  protected readonly cells = computed(() => {
    const columns = this.columns();
    const format = this.current().format;
    return this.rows().map((r) =>
      columns.map((c) => (c.num ? formatValue(r[c.field], format) : r[c.field] == null ? '' : String(r[c.field]))),
    );
  });
  private readonly chart = computed(() => measureChartSpec(this.current(), this.rows()));
  protected readonly description = computed(() => chartDescription(this.chart()));
  protected readonly empty = computed(() => this.emptyText() ?? emptyStateText(this.current()));
  protected readonly sourceUrl = computed(() => layerUrl(this.current().layer));

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly chartEl = viewChild<ElementRef<HTMLElement>>('chart');
  /** Width of the chart container in CSS pixels: null until measured, 0 while it is hidden. */
  private readonly width = signal<number | null>(null);
  private embedded: Result | null = null;
  private drawing: Promise<void> = Promise.resolve();
  private drawId = 0;
  private destroyed = false;

  constructor() {
    // Load the rows whenever the measure or its source changes.
    effect((onCleanup) => {
      this.request();
      const measure = untracked(this.measure);
      const source = untracked(this.source);
      let stale = false;
      onCleanup(() => {
        stale = true;
      });
      untracked(() => {
        this.state.set('loading');
        this.hasData.set(false);
        this.all.set([]);
        this.picked.set(undefined);
        this.tooltip.set(null);
      });
      queryPanelRows(measure, source).then(
        (rows) => {
          if (!stale && !this.destroyed) this.receive(measure, rows);
        },
        (err: unknown) => {
          if (stale || this.destroyed) return;
          console.warn(`${measure.title}: ${err instanceof Error ? err.message : String(err)}`);
          this.settle('error');
        },
      );
    });

    // Follow the width of the chart container. The first size is taken at once;
    // later changes wait for the resize to pause.
    effect((onCleanup) => {
      const el = this.chartEl()?.nativeElement;
      if (!el) {
        // The container is gone (a reload, or an empty or error state): drop its chart.
        this.width.set(null);
        this.dispose();
        return;
      }
      let timer: ReturnType<typeof setTimeout> | undefined;
      const observer = new ResizeObserver((entries) => {
        const w = Math.floor(entries[entries.length - 1].contentRect.width);
        clearTimeout(timer);
        if (!untracked(this.width) || w === 0) this.width.set(w);
        else timer = setTimeout(() => this.width.set(w), 120);
      });
      observer.observe(el);
      onCleanup(() => {
        clearTimeout(timer);
        observer.disconnect();
      });
    });

    // Draw the chart when its rows, its container, or the container's width change.
    effect(() => {
      const el = this.chartEl()?.nativeElement;
      const width = this.width();
      if (!el || !this.hasData() || width == null) return;
      const chart = this.chart();
      if (width === 0) {
        // Measured, and not laid out (table view, or a hidden tab): there is no chart to
        // wait for, so a panel that is still loading settles now and draws when it is shown.
        if (untracked(this.state) === 'loading') untracked(() => this.settle('ready'));
        return;
      }
      untracked(() => this.draw(el, chart, width));
    });

    inject(DestroyRef).onDestroy(() => {
      this.destroyed = true;
      this.dispose();
    });
  }

  /** Cancels any queued draw and releases the Vega view with its listeners and timers. */
  private dispose(): void {
    this.drawId += 1;
    this.embedded?.finalize();
    this.embedded = null;
  }

  private receive(measure: Measure, all: Attributes[]): void {
    const choices = pickChoices(measure, all);
    const picked = defaultPick(measure, all, choices);
    this.all.set(all);
    this.picked.set(picked);
    this.view.set('chart');
    this.emitLoaded();
    if (!this.rows().length) {
      this.settle('empty');
      return;
    }
    // The chart container is rendered now; the draw effect settles the panel as ready.
    this.hasData.set(true);
  }

  private emitLoaded(): void {
    this.loaded.emit({ measure: this.current(), rows: this.rows(), allRows: this.all(), picked: this.picked() });
  }

  private settle(state: Exclude<PanelState, 'loading'>): void {
    if (state !== 'ready') this.hasData.set(false);
    this.state.set(state);
    this.settled.emit(state);
  }

  /** Queues a draw. Draws run one at a time, and a draw that has been overtaken is skipped. */
  private draw(el: HTMLElement, chart: ReturnType<typeof measureChartSpec>, width: number): void {
    const id = (this.drawId += 1);
    this.drawing = this.drawing.then(async () => {
      if (id !== this.drawId) return;
      try {
        // vega-embed brings Vega and Vega-Lite with it; the import keeps all three out of the initial bundle.
        const { default: embed } = await import('vega-embed');
        const theme = this.theme();
        await fontReady(theme);
        if (id !== this.drawId) return;
        const spec = vegaLiteSpec(chart, theme, { width });
        this.tooltip.set(null);
        this.embedded?.finalize();
        this.embedded = null;
        if (!el.isConnected) return;
        const result = await embed(el, spec, {
          renderer: 'svg',
          actions: false,
          defaultStyle: false,
          // 1 is vega.Error: quiet about the hover layer's empty extent while nothing is hovered.
          logLevel: 1,
          tooltip: (_handler: unknown, event: MouseEvent, item: unknown, value: unknown) =>
            this.showTooltip(chart, event, item, value),
        });
        if (this.destroyed || !el.isConnected) {
          result.finalize();
          return;
        }
        this.embedded = result;
        if (this.state() === 'loading' && this.hasData()) this.settle('ready');
      } catch (err) {
        if (this.destroyed) return;
        console.error(`${chart.title}: the chart could not be drawn.`, err);
        if (this.state() === 'loading') this.settle('error');
      }
    });
  }

  /** The chart theme from the design tokens in effect on this element. */
  private theme(): VegaTheme {
    const css = getComputedStyle(this.host.nativeElement);
    const token = (name: string, fallback: string): string => css.getPropertyValue(name).trim() || fallback;
    const d = DEFAULT_VEGA_THEME;
    return {
      seriesColors: SERIES_TOKENS.map((name, i) => token(name, d.seriesColors[i])),
      textColor: token('--color-content-default-secondary', d.textColor),
      titleColor: token('--color-content-default', d.titleColor),
      gridColor: token('--color-border-default-subtle', d.gridColor),
      axisColor: token('--color-border-default', d.axisColor),
      thresholdColor: token('--color-content-default-secondary', d.thresholdColor),
      surfaceColor: token('--color-background-elevation-raised', d.surfaceColor),
      fontFamily: token('--typography-font-family-sans', d.fontFamily),
      fontSize: d.fontSize,
      titleFontSize: d.titleFontSize,
    };
  }

  /** Vega calls this on hover with the hovered item, and with no value when the pointer leaves. */
  private showTooltip(chart: ReturnType<typeof measureChartSpec>, event: MouseEvent, item: unknown, value: unknown): void {
    // With "nearest", the hovered item is a Voronoi cell that wraps the mark that wraps the row.
    let row = (item as { datum?: unknown } | null)?.datum as Record<string, unknown> | undefined;
    while (row && !(TOOLTIP_LABEL_FIELD in row) && row['datum']) row = row['datum'] as Record<string, unknown>;
    if (value == null || !row || !(TOOLTIP_LABEL_FIELD in row)) {
      this.tooltip.set(null);
      return;
    }
    const theme = this.theme();
    const bars = chart.type === 'bar' || chart.type === 'stacked';
    const rows: TooltipRow[] = [];
    chart.series.forEach((s, i) => {
      const text = row[tooltipValueField(i)];
      if (text == null || text === '') return;
      const style = seriesStyle(i, theme);
      rows.push({ name: s.name, value: String(text), color: style.color, path: SHAPE_PATHS[bars ? 'square' : style.shape] });
    });
    // Beside the pointer, on whichever side has room in the window.
    this.tooltip.set({
      title: String(row[TOOLTIP_LABEL_FIELD]),
      rows,
      left: event.clientX,
      top: event.clientY,
      flip: event.clientX > window.innerWidth * 0.55,
      above: event.clientY > window.innerHeight * 0.6,
    });
  }

  protected onPick(event: Event): void {
    const value = (event as EcologyChange).detail?.value;
    if (typeof value !== 'string' || value === this.picked() || !this.choices().includes(value)) return;
    this.picked.set(value);
    this.emitLoaded();
  }

  protected onView(event: Event): void {
    const value = (event as EcologyChange).detail?.value;
    if (value === 'chart' || value === 'table') {
      this.tooltip.set(null);
      this.view.set(value);
    }
  }

  /** A CSV of exactly the rows shown, with the table's columns. */
  protected downloadCsv(): void {
    const text = toCsv(this.columns(), this.rows());
    const name = csvFileName([this.programName(), this.current().title, this.picked()]);
    const url = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}
