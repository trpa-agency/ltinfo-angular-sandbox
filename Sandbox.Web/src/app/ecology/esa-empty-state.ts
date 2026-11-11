// Mirrors packages/ecology/src/components/esa-empty-state.astro at hub commit a7849d4.
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type EsaEmptyStateSize = 'xs' | 'sm' | 'md' | 'lg';

// One type role per size step, as in the hub.
const TITLE_TYPE: Record<EsaEmptyStateSize, string> = {
  xs: 'label-xs-strong',
  sm: 'label-sm-strong',
  md: 'label-md-strong',
  lg: 'title',
};
const DESC_TYPE: Record<EsaEmptyStateSize, string> = {
  xs: 'body-xs',
  sm: 'body-xs',
  md: 'body-sm',
  lg: 'body-md',
};

@Component({
  selector: 'esa-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="'esa-empty-state esa-empty-state--' + size()">
      <h3 [class]="titleClass()">{{ title() }}</h3>
      @if (description()) {
        <p [class]="descriptionClass()">{{ description() }}</p>
      }
      <div class="esa-empty-state__actions typography-label-md"><ng-content /></div>
    </div>
  `,
  styleUrl: './esa-empty-state.scss',
})
export class EsaEmptyState {
  /** What is absent, stated as a fact: "No results", "No documents yet". */
  readonly title = input.required<string>();
  /** One recovery action the reader can take, in 12 words or fewer. */
  readonly description = input<string>();
  readonly size = input<EsaEmptyStateSize>('md');

  protected readonly titleClass = computed(
    () => `esa-empty-state__title typography-${TITLE_TYPE[this.size()]}`,
  );
  protected readonly descriptionClass = computed(
    () => `esa-empty-state__description typography-${DESC_TYPE[this.size()]}`,
  );
}
