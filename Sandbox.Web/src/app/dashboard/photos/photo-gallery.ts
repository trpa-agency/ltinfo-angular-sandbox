import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';

import type { ProgramImage } from '../../api/models';
import { PhotoCredit } from './photo-credit';
import { PhotoViewer } from './photo-viewer';

// The photos of a program other than the key photo, as a grid of equal frames
// with each caption under its photo. A click opens the larger view.
//
// Every frame is 4 to 3 and the photo is cropped to fill it, so tall, wide,
// and square photos line up, and the grid has its final shape before any file
// arrives. Files load only as they near the viewport. A photo whose file fails
// keeps its frame and caption and shows a neutral well with a short note.
//
//   size="md"  small tiles, for the Photos section of the map and charts layouts
//   size="lg"  large tiles, for the content layout, where the gallery is a lead element
//
// With no photos to show the component renders nothing, so a program with one
// photo (the key photo) or none never gets an empty gallery.
@Component({
  selector: 'app-photo-gallery',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [PhotoCredit],
  host: { '[attr.data-size]': 'size()' },
  template: `
    @if (images().length > 0) {
      <ul class="gallery" aria-label="Program photos">
        @for (photo of images(); track photo.MonitoringProgramImageID) {
          <li class="gallery__item">
            <figure class="gallery__figure">
              @if (viewer.hasFailed(photo)) {
                <div class="gallery__frame gallery__frame--missing">
                  <p class="typography-meta">This photo could not be loaded</p>
                </div>
              } @else {
                <button type="button" class="gallery__frame gallery__open" (click)="viewer.open(photo)">
                  <img
                    class="gallery__img"
                    [src]="photo.Url"
                    [alt]="viewer.altText(photo)"
                    loading="lazy"
                    decoding="async"
                    (error)="viewer.markFailed(photo)"
                  />
                  <span class="visually-hidden">View larger photo</span>
                </button>
              }
              @if (photo.Caption || photo.PhotoCredit) {
                <figcaption class="gallery__caption typography-meta">
                  @if (photo.Caption) {
                    <span class="gallery__text">{{ photo.Caption }}</span>
                  }
                  <span class="gallery__credit"><app-photo-credit [credit]="photo.PhotoCredit" /></span>
                </figcaption>
              }
            </figure>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './photo-gallery.scss',
})
export class PhotoGallery {
  protected readonly viewer = inject(PhotoViewer);

  /** The photos to show. The templates pass every photo but the key photo. */
  readonly images = input.required<readonly ProgramImage[]>();
  readonly size = input<'md' | 'lg'>('md');
}
