// Mirrors packages/ecology/src/components/esa-stat.astro at hub commit a7849d4.
import { booleanAttribute, ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'esa-stat',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="esa-stat" [class.esa-stat--accent]="accent()">
      <div class="esa-stat__value typography-display-sm">{{ value() }}</div>
      <div class="esa-stat__label typography-label-md">{{ label() }}</div>
      @if (sub()) {
        <div class="esa-stat__sub typography-body-sm">{{ sub() }}</div>
      }
    </div>
  `,
  styleUrl: './esa-stat.scss',
})
export class EsaStat {
  /** The metric itself. */
  readonly value = input.required<string | number>();
  /** What the value counts or measures, in a few words. */
  readonly label = input.required<string>();
  /** A short datum qualifying the value: a period, a rate, a comparison. */
  readonly sub = input<string>();
  /** Tints the value with the brand color. */
  readonly accent = input(false, { transform: booleanAttribute });
}
