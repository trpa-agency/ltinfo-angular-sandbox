import { Signal, computed, signal } from '@angular/core';

import type { ChartPanelData } from '../chart-panel/chart-panel';
import {
  PanelState,
  SitesSummary,
  Tile,
  initialTileState,
  recordYears,
  summaryTiles,
} from '../../lib/sites';

/**
 * Folds what the data panels report into the four summary tiles (Total sites,
 * Active sites, Record began, Latest data). A template makes one tracker, hands
 * every panel's (loaded) and (settled) output to it, and reads tiles().
 *
 * The same logic as the client script at the bottom of Program.astro in the
 * LT Info Monitoring Dashboard repo, with the panel events arriving as Angular
 * outputs instead of DOM events.
 */
export class TileTracker {
  private readonly sites = signal<SitesSummary | null>(null);
  private readonly sitesState = signal<PanelState>('loading');
  private readonly chartStates = signal<Readonly<Record<string, PanelState>>>({});
  private readonly years = signal<readonly number[]>([]);

  /** The four tiles, recomputed whenever a panel reports. */
  readonly tiles: Signal<Tile[]>;

  /**
   * @param hasSiteSource the program has a sitesLayer or a mapLayer
   * @param chartKeys one key per chart panel on the page, the sites-per-year chart included
   */
  constructor(hasSiteSource: Signal<boolean>, chartKeys: Signal<readonly string[]>) {
    this.tiles = computed(() => {
      const keys = chartKeys();
      const states = this.chartStates();
      return summaryTiles({
        ...initialTileState(hasSiteSource(), keys.length),
        sitesState: hasSiteSource() ? this.sitesState() : 'empty',
        sites: this.sites(),
        chartsPending: keys.filter((key) => (states[key] ?? 'loading') === 'loading').length,
        years: [...this.years()],
      });
    });
  }

  /** A chart's rows arrived. Month axes carry no year; dates, years, and spans like 2016-2019 do. */
  chartLoaded(data: ChartPanelData): void {
    if (data.measure.xType === 'month') return;
    this.addYears(recordYears(data.rows.map((row) => row[data.measure.x])));
  }

  /** A chart reached ready, empty, or error. */
  chartSettled(key: string, state: PanelState): void {
    this.chartStates.update((states) => ({ ...states, [key]: state }));
  }

  /** The sites or areas arrived. */
  sitesLoaded(summary: SitesSummary): void {
    this.sites.set(summary);
    this.sitesState.set(summary.total ? 'ready' : 'empty');
    this.addYears(summary.years);
  }

  /** The sites panel reached ready, empty, or error. Ready is recorded by sitesLoaded. */
  sitesSettled(state: PanelState): void {
    if (state === 'error' || state === 'empty') this.sitesState.set(state);
  }

  private addYears(found: readonly number[]): void {
    if (found.length === 0) return;
    this.years.update((years) => [...new Set([...years, ...found])]);
  }
}
