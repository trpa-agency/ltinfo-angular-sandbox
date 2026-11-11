// Mirrors packages/ecology/src/components/esa-card.astro at hub commit a7849d4.
import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type EsaCardVariant = 'default' | 'outlined' | 'elevated' | 'filled';
export type EsaCardHeaderVariant = 'default' | 'primary' | 'muted';
export type EsaCardPadding = 'none' | 'compact' | 'default' | 'spacious';

// The hub's named slots become content projection:
//   default slot      -> the body
//   slot="actions"    -> the right side of the header (needs a title)
//   slot="footer"     -> the footer band
@Component({
  selector: 'esa-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div [class]="classes()">
      @if (title()) {
        <div class="esa-card__header">
          <div class="esa-card__header-content">
            <div class="esa-card__titles">
              <h3 class="esa-card__title typography-title-sm-strong">{{ title() }}</h3>
            </div>
          </div>
          <div class="esa-card__actions typography-label-md">
            <ng-content select="[slot=actions]" />
          </div>
        </div>
      }
      <div class="esa-card__body typography-body-md"><ng-content /></div>
      <div class="esa-card__footer typography-meta"><ng-content select="[slot=footer]" /></div>
    </div>
  `,
  styleUrl: './esa-card.scss',
})
export class EsaCard {
  /** What the card is: the name of the record, section, or metric it holds. */
  readonly title = input<string>();
  readonly variant = input<EsaCardVariant>('default');
  readonly headerVariant = input<EsaCardHeaderVariant>('default');
  readonly padding = input<EsaCardPadding>('default');

  protected readonly classes = computed(() =>
    [
      'esa-card',
      this.variant() !== 'default' ? `esa-card--${this.variant()}` : '',
      this.headerVariant() !== 'default' ? `esa-card--header-${this.headerVariant()}` : '',
      this.padding() !== 'default' ? `esa-card--padding-${this.padding()}` : '',
    ]
      .filter(Boolean)
      .join(' '),
  );
}
