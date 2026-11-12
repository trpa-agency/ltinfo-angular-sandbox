import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { EsaStat } from '../../ecology/esa-stat';
import type { Tile } from '../../lib/sites';
import { TILE_NA } from '../../lib/sites';

// The four summary tiles of a program page: Total sites, Active sites, Record
// began, and Latest data. Each is an esa-stat; this component only lays them
// out as one strip, four across, or two across when the strip is narrow.
//
// size="md" is the strip in the map and charts headers. size="sm" is the
// quieter strip of the content header, where most tiles read "n/a".
@Component({
  selector: 'app-summary-tiles',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EsaStat],
  host: { '[attr.data-size]': 'size()' },
  // A tile with nothing to report ("n/a") is left out, and the strip with it when none is left.
  template: `
    @if (shown().length > 0) {
      <div class="tiles" role="group" aria-label="Program summary">
        @for (tile of shown(); track tile.key) {
          <div class="tile" [attr.data-tile]="tile.key">
            <esa-stat [value]="tile.value" [label]="tile.label" [sub]="tile.sub" />
          </div>
        }
      </div>
    }
  `,
  styleUrl: './summary-tiles.scss',
})
export class SummaryTiles {
  readonly tiles = input.required<Tile[]>();
  protected readonly shown = computed(() => this.tiles().filter((tile) => tile.value !== TILE_NA));
  readonly size = input<'sm' | 'md'>('md');
}
