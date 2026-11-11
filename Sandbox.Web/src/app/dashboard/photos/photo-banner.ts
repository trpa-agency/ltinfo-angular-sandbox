import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// What the compact program header shows in the photo slot when there is no key photo: a
// neutral well filling the slot, with one line saying why. Used when the program has no
// photo, and when its photo fails to load, so neither case leaves a broken image or a hole.
@Component({
  selector: 'app-photo-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-reason]': 'reason()' },
  template: `
    <div class="banner">
      <p class="banner__note typography-meta">
        {{ reason() === 'failed' ? 'The program photo could not be loaded' : 'No program photo yet' }}
      </p>
    </div>
  `,
  styleUrl: './photo-banner.scss',
})
export class PhotoBanner {
  /** "none": the program has no photo. "failed": it has one and the file did not load. */
  readonly reason = input<'none' | 'failed'>('none');
}
