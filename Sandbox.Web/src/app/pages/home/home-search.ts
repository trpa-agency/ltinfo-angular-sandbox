import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, model } from '@angular/core';

// The real Ecology Lit elements; importing the bundle registers esa-text-field.
import '../../../ecology/ecology-elements.js';

/**
 * The "Find a program or partner" box: the Ecology esa-text-field, kept in its own small
 * component so CUSTOM_ELEMENTS_SCHEMA (which silences unknown-element checks) covers only it.
 * esa-text-field fires "change" on every keystroke, with the text in $event.detail.value.
 *
 *   <app-home-search [(value)]="search" />
 */
@Component({
  selector: 'app-home-search',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  template: `
    <esa-text-field
      class="home-search"
      label="Find a program or partner"
      placeholder="e.g. Ozone or Desert Research Institute"
      size="sm"
      type="search"
      autocomplete="off"
      [value]="value()"
      (change)="onChange($event)"
    ></esa-text-field>
  `,
  styles: `
    :host,
    .home-search {
      display: block;
    }
  `,
})
export class HomeSearch {
  readonly value = model('');

  protected onChange(event: Event): void {
    this.value.set((event as CustomEvent<{ value: string }>).detail.value);
  }
}
