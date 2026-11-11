import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  input,
  output,
} from '@angular/core';

// The real Ecology Lit elements; this import registers esa-button-toggle.
import '../../../ecology/ecology-elements.js';

import { Template } from '../../api/models';
import { TEMPLATE_LABELS, TEMPLATE_OPTIONS, parseTemplate } from '../../dashboard/templates/template-info';
import { EsaBadge } from '../../ecology/esa-badge';
import { EsaButton } from '../../ecology/esa-button';

/** The detail every Ecology form element sends with its "change" event. */
type EcologyChange = CustomEvent<{ value: string }>;

// The "Page layout" control of a program page. The toggle shows the layout on
// screen and lets the reader try the other two; Save layout stores the one on
// screen. While the layout on screen differs from the saved one, a notice says
// it is a preview and names both.
//
// The toggle is a Lit element, so this small component carries
// CUSTOM_ELEMENTS_SCHEMA (see program-filters.ts for the three rules). It sits
// on the page itself, not in a card: a card clips what leaves its box.
@Component({
  selector: 'app-layout-control',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [EsaBadge, EsaButton],
  template: `
    <div class="layout">
      <!-- Whatever the page puts here (the back link) shares the line with the control. -->
      <div class="layout__lead"><ng-content /></div>
      <div class="layout__controls">
        <esa-button-toggle
          class="layout__toggle"
          label="Page layout"
          size="sm"
          [options]="options"
          [value]="shown()"
          (change)="onPick($event)"
        ></esa-button-toggle>
        <esa-button
          class="layout__save"
          size="sm"
          [disabled]="!isPreview()"
          [loading]="saving()"
          (click)="save.emit()"
        >
          Save layout
        </esa-button>
      </div>
    </div>

    <!-- Always in the page, so a screen reader hears the notice when it appears. -->
    <div class="layout__notice typography-body-sm" role="status" [class.is-preview]="isPreview()">
      @if (isPreview()) {
        <esa-badge variant="warning" value="Preview" size="sm" />
        <span class="layout__notice-text">
          This is the {{ label(shown()) }} layout. The saved layout is {{ label(saved()) }}, and
          nothing changes until you save.
        </span>
        <button type="button" class="layout__back" (click)="pick.emit(saved())">
          Back to the saved layout
        </button>
      }
    </div>

    <p class="layout__error typography-body-sm" role="alert">{{ error() }}</p>
  `,
  styleUrl: './layout-control.scss',
})
export class LayoutControl {
  /** The layout stored for the program. */
  readonly saved = input.required<Template>();
  /** The layout on screen: the saved one, or a preview. */
  readonly shown = input.required<Template>();
  readonly saving = input(false);
  readonly error = input('');

  /** The reader chose a layout to look at. */
  readonly pick = output<Template>();
  /** The reader asked to store the layout on screen. */
  readonly save = output<void>();

  protected readonly options = TEMPLATE_OPTIONS;
  protected readonly isPreview = computed(() => this.shown() !== this.saved());

  protected label(template: Template): string {
    return TEMPLATE_LABELS[template];
  }

  protected onPick(event: Event): void {
    const template = parseTemplate((event as EcologyChange).detail.value);
    if (template) this.pick.emit(template);
  }
}
