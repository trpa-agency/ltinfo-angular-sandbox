import { ChangeDetectionStrategy, Component, input } from '@angular/core';

import { EsaStat } from '../../ecology/esa-stat';
import type { Tile } from '../../lib/sites';

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
  template: `
    <div class="tiles" role="group" aria-label="Program summary">
      @for (tile of tiles(); track tile.key) {
        <div class="tile" [attr.data-tile]="tile.key">
          <esa-stat [value]="tile.value" [label]="tile.label" [sub]="tile.sub" />
        </div>
      }
    </div>
  `,
  styleUrl: './summary-tiles.scss',
})
export class SummaryTiles {
  readonly tiles = input.required<Tile[]>();
  readonly size = input<'sm' | 'md'>('md');
}
