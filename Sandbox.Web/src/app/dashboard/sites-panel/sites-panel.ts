import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';

import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import type { PanelState, SitesPanelConfig, SitesSummary } from '../../lib/sites';

// PLACEHOLDER. The inputs and outputs below are the contract the page templates
// are written against; the Leaflet implementation replaces the template only.
@Component({
  selector: 'app-sites-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  // Contract: the host element always carries data-state = loading | ready | empty | error.
  host: { '[attr.data-state]': 'state()' },
  imports: [EsaCard, EsaEmptyState],
  template: `
    <esa-card [title]="'Sites'">
      <esa-empty-state [title]="'Map panel placeholder'" [description]="'The Leaflet map and site list render here.'" size="sm" />
    </esa-card>
  `,
})
export class SitesPanel {
  /** loading, ready, empty, or error; mirrored to data-state on the host. */
  protected readonly state = signal<PanelState>('ready');

  /** Program name, category color, and the program's sitesLayer or mapLayer plus overlays. */
  readonly config = input.required<SitesPanelConfig>();
  /** A taller map, for the map template. */
  readonly tall = input(false);

  /** Fires when sites or areas have loaded (and again after a pick change). */
  readonly loaded = output<SitesSummary>();
  /** Fires when the panel reaches ready, empty, or error. */
  readonly settled = output<PanelState>();
}
