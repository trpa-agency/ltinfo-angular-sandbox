import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { EsaStat } from '../../ecology/esa-stat';
import { TREND_HEIGHT, TREND_WIDTH, trend } from '../../lib/headline';
import type { Tile } from '../../lib/sites';
import { TILE_NA } from '../../lib/sites';

// The summary tiles of a program page, in reading order: the headline (the first measure's
// latest value with its standard and a small trend line), Total sites, Active sites, and
// Record. Each is an esa-stat; this component only lays them out as one strip that wraps.
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
        @for (item of shown(); track item.tile.key) {
          <div class="tile" [attr.data-tile]="item.tile.key">
            <esa-stat [value]="item.tile.value" [label]="item.tile.label" [sub]="item.tile.sub" />
            <!-- mon-lego-checked: esa-stat carries the figure. Ecology has no sparkline lego, so
                 the trend line is a custom inline SVG. It is decorative: the first chart on the
                 page draws the same record with its axes, table, and CSV. -->
            @if (item.trend; as line) {
              <svg class="trend" [attr.viewBox]="viewBox" aria-hidden="true" focusable="false">
                @if (line.standardY !== null) {
                  <line
                    class="trend__standard"
                    x1="0"
                    [attr.x2]="width"
                    [attr.y1]="line.standardY"
                    [attr.y2]="line.standardY"
                  />
                }
                <polyline class="trend__line" [attr.points]="line.line" />
                <circle class="trend__end" [attr.cx]="line.end.x" [attr.cy]="line.end.y" r="2" />
              </svg>
            }
          </div>
        }
      </div>
    }
  `,
  styleUrl: './summary-tiles.scss',
})
export class SummaryTiles {
  readonly tiles = input.required<Tile[]>();
  readonly size = input<'sm' | 'md'>('md');

  protected readonly width = TREND_WIDTH;
  protected readonly viewBox = `0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`;

  /** The tiles with something to report, each with its trend line when it carries a record. */
  protected readonly shown = computed(() =>
    this.tiles()
      .filter((tile) => tile.value !== TILE_NA)
      .map((tile) => ({ tile, trend: tile.points ? trend(tile.points, tile.threshold ?? null) : null })),
  );
}
