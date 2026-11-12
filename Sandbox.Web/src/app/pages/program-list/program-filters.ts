import {
  ChangeDetectionStrategy,
  Component,
  CUSTOM_ELEMENTS_SCHEMA,
  computed,
  input,
  model,
} from '@angular/core';

// The real Ecology Lit elements. Importing the vendored bundle once, for its
// side effect, registers esa-text-field, esa-select, and esa-button-toggle.
import '../../../ecology/ecology-elements.js';

import { Category, Template } from '../../api/models';
import { TEMPLATE_OPTIONS } from '../../dashboard/templates/template-info';

/** The detail every Ecology form element sends with its "change" event. */
type EcologyChange = CustomEvent<{ value: string }>;

export type FeaturedFilter = 'all' | 'featured';

/** A layout to filter by, or the empty string for every layout. */
export type LayoutFilter = '' | Template;

interface Option {
  label: string;
  value: string;
}

// This component uses the Lit elements, so it carries CUSTOM_ELEMENTS_SCHEMA. The schema turns off Angular's check for
// unknown elements AND unknown attributes in this template, so a typo here
// compiles clean and does nothing. Keeping it in one small component keeps
// that blind spot small.
//
// ESA's three rules for Angular (ecology: apps/site/src/pages/guide/angular.astro),
// each of which fails silently when broken:
//   1. Read the payload from $event.detail. These are CustomEvents, including
//      the one named "change"; $event.target.value is empty.
//   2. Write event names exactly as documented: lowercase "change".
//   3. Arrays and objects need [property] binding: [options], never options="...".
@Component({
  selector: 'app-program-filters',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  templateUrl: './program-filters.html',
  styleUrl: './program-filters.scss',
})
export class ProgramFilters {
  readonly categories = input.required<Category[]>();
  /** How many programs use each layout, for the counts in the Layout list. */
  readonly layoutCounts = input.required<Record<Template, number>>();
  /** The Layout filter is for staff; visitors filter by what a program is, not how it is laid out. */
  readonly showLayout = input(true);

  // Two-way bound by the parent: [(search)], [(categoryId)], [(layout)], [(featured)].
  readonly search = model('');
  readonly categoryId = model('');
  readonly layout = model<LayoutFilter>('');
  readonly featured = model<FeaturedFilter>('all');

  // esa-select compares option values as strings, so the numeric CategoryID is
  // converted here. The empty value is the "no filter" choice.
  protected readonly categoryOptions = computed<Option[]>(() => [
    { label: 'All categories', value: '' },
    ...this.categories().map((category) => ({
      label: `${category.CategoryName} (${category.ProgramCount})`,
      value: String(category.CategoryID),
    })),
  ]);

  // The stored value ("context") is the option value; the reader sees "Content".
  protected readonly layoutOptions = computed<Option[]>(() => [
    { label: 'All layouts', value: '' },
    ...TEMPLATE_OPTIONS.map((option) => ({
      label: `${option.label} (${this.layoutCounts()[option.value]})`,
      value: option.value,
    })),
  ]);

  protected readonly featuredOptions: Option[] = [
    { label: 'All programs', value: 'all' },
    { label: 'Featured only', value: 'featured' },
  ];

  protected onSearch(event: Event): void {
    this.search.set((event as EcologyChange).detail.value);
  }

  protected onCategory(event: Event): void {
    this.categoryId.set((event as EcologyChange).detail.value);
  }

  protected onLayout(event: Event): void {
    this.layout.set((event as EcologyChange).detail.value as LayoutFilter);
  }

  protected onFeatured(event: Event): void {
    this.featured.set((event as EcologyChange).detail.value as FeaturedFilter);
  }
}
