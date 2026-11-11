// Mirrors packages/ecology/src/components/esa-button.astro at hub commit a7849d4.
import {
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
} from '@angular/core';

export type EsaButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type EsaButtonAppearance = 'fill' | 'outline' | 'soft';
export type EsaButtonSize = 'xs' | 'sm' | 'md' | 'lg';

// Button text is microcopy: one line in a box whose height comes from padding.
const LABEL_TYPE: Record<EsaButtonSize, string> = {
  xs: 'microcopy-2xs',
  sm: 'microcopy-xs',
  md: 'microcopy-md',
  lg: 'microcopy-lg',
};

// Listen for (click) on <esa-button> itself: the native click bubbles out of
// the inner <button>, and a disabled or loading button fires none.
@Component({
  selector: 'esa-button',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <span [class]="classes()">
      <button
        [class]="nativeClass()"
        [attr.type]="type()"
        [disabled]="disabled() || loading()"
        [attr.aria-busy]="loading() ? 'true' : null"
        [attr.aria-pressed]="active() ? 'true' : null"
      >
        @if (loading()) {
          <span class="esa-button__spinner" aria-hidden="true"></span>
        }
        <span class="esa-button__label" [class.esa-button__label--hidden]="loading()">
          <ng-content />
        </span>
      </button>
    </span>
  `,
  styleUrl: './esa-button.scss',
})
export class EsaButton {
  readonly variant = input<EsaButtonVariant>('primary');
  readonly appearance = input<EsaButtonAppearance>('fill');
  readonly size = input<EsaButtonSize>('md');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Shows a spinner in place of the label and blocks clicks. */
  readonly loading = input(false, { transform: booleanAttribute });
  /** A toggle's pressed state (aria-pressed and the selected look). */
  readonly active = input(false, { transform: booleanAttribute });

  protected readonly classes = computed(() =>
    [
      'esa-button',
      `esa-button--variant-${this.variant()}`,
      `esa-button--appearance-${this.appearance()}`,
      `esa-button--${this.size()}`,
      this.active() ? 'esa-button--active' : '',
      this.disabled() ? 'esa-button--disabled' : '',
      this.loading() ? 'esa-button--loading' : '',
    ]
      .filter(Boolean)
      .join(' '),
  );

  protected readonly nativeClass = computed(
    () => `esa-button__native typography-${LABEL_TYPE[this.size()]}`,
  );
}
