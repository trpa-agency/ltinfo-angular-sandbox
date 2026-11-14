import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import type { MonitoringProgramDetail } from '../../api/models';
import { EsaBadge } from '../../ecology/esa-badge';
import type { Tile } from '../../lib/sites';
import { PhotoBanner } from '../photos/photo-banner';
import { PhotoHero } from '../photos/photo-hero';
import { PhotoViewer } from '../photos/photo-viewer';
import { SummaryTiles } from '../summary-tiles/summary-tiles';

// The header every template starts with: the program name, the category and Featured
// badges, the summary tiles, and the key photo. Neutral: a white card with a hairline
// border, quiet badges, and no category color.
//
//   variant="compact"  the map and charts layouts. A short band with the photo
//                      filling its end, so the lead section starts high on the page.
//   variant="feature"  the content layout. The photo is large, the tiles are
//                      quiet, and the template can project a lead paragraph
//                      under the name with slot="lead".
//
// A program with no photo gives the text the full width in both variants: most programs
// have none, and an empty frame would lead the page. A photo that fails to load is the one
// case with something to say, so the compact band keeps a neutral well (app-photo-banner)
// in the slot with one line saying so.
@Component({
  selector: 'app-program-header',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EsaBadge, PhotoBanner, PhotoHero, SummaryTiles],
  host: {
    '[attr.data-variant]': 'variant()',
    '[attr.data-photo]': 'photoState()',
  },
  template: `
    <header class="head">
      <div class="head__body">
        <div class="head__text">
          <!-- The name comes first in the document. The badges are drawn after it
               on the same line (compact) or above it (feature). -->
          <div class="head__name">
            <h1 class="head__title typography-heading-lg">{{ program().MonitoringProgramName }}</h1>
            <div class="head__badges">
              <esa-badge [value]="program().CategoryName" />
              @if (program().IsFeatured) {
                <esa-badge value="Featured" />
              }
            </div>
          </div>
          <ng-content select="[slot=lead]" />
          <app-summary-tiles
            class="head__tiles"
            [tiles]="tiles()"
            [size]="variant() === 'feature' ? 'sm' : 'md'"
          />
        </div>
        @if (photoState() === 'shown') {
          <app-photo-hero
            class="head__photo"
            [image]="keyPhoto()!"
            [size]="variant() === 'feature' ? 'feature' : 'cover'"
          />
        } @else if (photoState() === 'failed' && variant() === 'compact') {
          <app-photo-banner class="head__photo head__photo--empty" reason="failed" />
        }
      </div>
    </header>
  `,
  styleUrl: './program-header.scss',
})
export class ProgramHeader {
  private readonly viewer = inject(PhotoViewer);

  readonly program = input.required<MonitoringProgramDetail>();
  readonly tiles = input.required<Tile[]>();
  readonly variant = input<'compact' | 'feature'>('compact');

  /** The API sends the key photo first. */
  protected readonly keyPhoto = computed(() => this.program().Images[0] ?? null);

  /** shown: the key photo is on the page. none: the program has no photo. failed: its file did not load. */
  protected readonly photoState = computed<'shown' | 'none' | 'failed'>(() => {
    const photo = this.keyPhoto();
    if (!photo) return 'none';
    return this.viewer.hasFailed(photo) ? 'failed' : 'shown';
  });
}
