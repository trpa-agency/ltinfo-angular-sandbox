import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterRenderEffect,
  inject,
  viewChild,
} from '@angular/core';

import { EsaButton } from '../../ecology/esa-button';
import { PhotoCredit } from './photo-credit';
import { PhotoViewer } from './photo-viewer';

// The larger view of a photo: a native <dialog>, opened with showModal().
// The browser supplies what a modal needs: focus moves into the dialog and
// stays there, Escape closes it, the page behind is inert, and focus returns
// to the photo that was clicked. This component adds the arrow keys, the
// Previous and Next buttons, and closing on a click outside the panel.
//
// One of these sits on the program page. The hero and the gallery open it
// through the shared PhotoViewer.
@Component({
  selector: 'app-photo-lightbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EsaButton, PhotoCredit],
  template: `
    <dialog
      #dialog
      class="lightbox"
      aria-labelledby="photo-lightbox-title"
      (close)="viewer.close()"
      (click)="closeOnBackdrop($event)"
      (keydown)="onKey($event)"
    >
      @let photo = viewer.current();
      @if (photo) {
        <div class="lightbox__panel">
          <div class="lightbox__bar">
            <h2 id="photo-lightbox-title" class="lightbox__title typography-label-md-strong">
              Photo {{ viewer.position() }} of {{ viewer.photos().length }}
            </h2>
            <esa-button variant="secondary" appearance="outline" size="sm" (click)="dialog.close()">
              Close
            </esa-button>
          </div>

          <div class="lightbox__stage">
            <img class="lightbox__img" [src]="photo.Url" [alt]="viewer.altText(photo)" />
          </div>

          <div class="lightbox__foot">
            <p class="lightbox__caption typography-body-sm" aria-live="polite">
              @if (photo.Caption) {
                <span>{{ photo.Caption }}</span>
              }
              <span class="lightbox__credit typography-meta"><app-photo-credit [credit]="photo.PhotoCredit" /></span>
            </p>
            @if (viewer.photos().length > 1) {
              <div class="lightbox__nav">
                <esa-button variant="secondary" appearance="outline" size="sm" (click)="viewer.step(-1)">
                  Previous
                </esa-button>
                <esa-button variant="secondary" appearance="outline" size="sm" (click)="viewer.step(1)">
                  Next
                </esa-button>
              </div>
            }
          </div>
        </div>
      }
    </dialog>
  `,
  styleUrl: './photo-lightbox.scss',
})
export class PhotoLightbox {
  protected readonly viewer = inject(PhotoViewer);

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    // The viewer says which photo is open; the dialog follows it. This runs
    // after rendering, so the panel is in the dialog before showModal() looks
    // for the first control to focus.
    afterRenderEffect(() => {
      const dialog = this.dialog().nativeElement;
      const open = this.viewer.current() !== null;
      if (open && !dialog.open) dialog.showModal();
      if (!open && dialog.open) dialog.close();
    });
  }

  /** A click on the dialog element itself lands on the backdrop; a click in the panel does not. */
  protected closeOnBackdrop(event: MouseEvent): void {
    if (event.target === event.currentTarget) this.dialog().nativeElement.close();
  }

  protected onKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') {
      this.viewer.step(1);
      event.preventDefault();
    } else if (event.key === 'ArrowLeft') {
      this.viewer.step(-1);
      event.preventDefault();
    }
  }
}
