import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import type { Attributes } from '../../lib/map-service';
import type { Measure, PanelSource } from '../../lib/measures';
import type { PanelState } from '../../lib/sites';

/** What a chart panel reports once its rows have arrived. */
export interface ChartPanelData {
  measure: Measure;
  rows: Attributes[];
}

// PLACEHOLDER. The inputs and outputs below are the contract the page templates
// are written against; the Vega-Lite implementation replaces the template only.
@Component({
  selector: 'app-chart-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Contract: the host element always carries data-state = loading | ready | empty | error.
  host: { '[attr.data-state]': 'state()' },
  imports: [EsaCard, EsaEmptyState],
  template: `
    <esa-card [title]="measure().title">
      <esa-empty-state [title]="'Chart panel placeholder'" [description]="'The Vega-Lite chart for this measure renders here.'" size="sm" />
    </esa-card>
  `,
})
export class ChartPanel {
  /** loading, ready, empty, or error; mirrored to data-state on the host. */
  protected readonly state = signal<PanelState>('ready');

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
}
