import { ChangeDetectionStrategy, Component, input } from '@angular/core';

// What a program page shows in place of a key photo: a quiet band in the
// category color that names the category. Used when the program has no photo,
// and when its photo fails to load, so neither case leaves a broken image or a
// hole. The color arrives as --category-color from the page.
@Component({
  selector: 'app-photo-banner',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-reason]': 'reason()' },
  template: `
    <div class="banner">
      <span class="banner__mark" aria-hidden="true"></span>
      <p class="banner__category typography-eyebrow-md">{{ category() }}</p>
      <p class="banner__note typography-meta">
        {{ reason() === 'failed' ? 'The program photo could not be loaded' : 'No program photo yet' }}
      </p>
    </div>
  `,
  styleUrl: './photo-banner.scss',
})
export class PhotoBanner {
  readonly category = input.required<string>();
  /** "none": the program has no photo. "failed": it has one and the file did not load. */
  readonly reason = input<'none' | 'failed'>('none');
}
