// Mirrors packages/ecology/src/components/esa-badge.astro at hub commit a7849d4.
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type EsaBadgeVariant =
  'neutral' | 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'info';
export type EsaBadgeSize = 'xs' | 'sm' | 'md' | 'lg';

// A badge is microcopy at emphasis: one composite per size, as in the hub.
const LABEL_TYPE: Record<EsaBadgeSize, string> = {
  xs: 'microcopy-2xs-strong',
  sm: 'microcopy-xs-strong',
  md: 'microcopy-sm-strong',
  lg: 'microcopy-md-strong',
};

@Component({
  selector: 'esa-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()">
      @if (!dot()) {
        <span class="esa-badge__text">{{ value() }}</span>
      }
      @if (dot() && label()) {
        <span class="visually-hidden">{{ label() }}</span>
      }
    </span>
  `,
  styleUrl: './esa-badge.scss',
})
export class EsaBadge {
  readonly value = input<string | number>();
  readonly variant = input<EsaBadgeVariant>('neutral');
  readonly size = input<EsaBadgeSize>('md');
  readonly dot = input(false, { transform: booleanAttribute });
  /** Accessible name for dot mode, which renders no visible text. */
  readonly label = input<string>();

  protected readonly classes = computed(() =>
    [
      'esa-badge',
      `esa-badge--${this.variant()}`,
      `esa-badge--${this.size()}`,
      `typography-${LABEL_TYPE[this.size()]}`,
      this.dot() ? 'esa-badge--dot' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
