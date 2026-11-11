import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import type { ProgramImage } from '../../api/models';
import { PhotoCredit } from './photo-credit';
import { PhotoViewer } from './photo-viewer';

// The key photo of a program, with its caption and credit. A click opens the
// larger view.
//
//   size="cover"    fills whatever box the header gives it, cropped to fit,
//                   with the caption on a scrim over the foot of the photo.
//                   This is the photo of the map and charts headers.
//   size="feature"  a 4 to 3 frame with the whole caption under it. This is
//                   the large photo of the content header.
//
// The frame has its size before the file arrives, so nothing moves when it
// does. If the file fails, the viewer is told and the header swaps this for
// the category banner.
@Component({
  selector: 'app-photo-hero',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhotoCredit],
  host: { '[attr.data-size]': 'size()' },
  template: `
    <figure class="hero">
      <button type="button" class="hero__open" (click)="viewer.open(image())">
        <img
          class="hero__img"
          [src]="image().Url"
          [alt]="alt()"
          decoding="async"
          fetchpriority="high"
          (error)="viewer.markFailed(image())"
        />
        <span class="visually-hidden">View larger photo</span>
      </button>
      @if (image().Caption || image().PhotoCredit) {
        <figcaption class="hero__caption typography-meta">
          @if (image().Caption) {
            <span class="hero__text">{{ image().Caption }}</span>
          }
          <app-photo-credit [credit]="image().PhotoCredit" />
        </figcaption>
      }
    </figure>
  `,
  styleUrl: './photo-hero.scss',
})
export class PhotoHero {
  protected readonly viewer = inject(PhotoViewer);

  readonly image = input.required<ProgramImage>();
  readonly size = input<'cover' | 'feature'>('cover');

  protected readonly alt = computed(() => this.viewer.altText(this.image()));
}
