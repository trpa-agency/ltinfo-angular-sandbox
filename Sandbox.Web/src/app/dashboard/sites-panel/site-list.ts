import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';

// The real Ecology Lit elements; this import registers esa-text-field once for the app.
import '../../../ecology/ecology-elements.js';

import { EsaBadge } from '../../ecology/esa-badge';
import { countLine, plural, type ListGroup, type ListItem } from '../../lib/sites';

interface GroupView {
  label: string;
  rows: ListItem[];
}

/**
 * The list beside the map: a search box, a count line, groups by status or rating with
 * counts, and one button per site or area. Clicking a row hands its key back through
 * (siteSelect); the panel then flies the map there. The panel marks the row for a feature
 * clicked on the map through [selectedKey] and reveal(key).
 *
 * CUSTOM_ELEMENTS_SCHEMA is here for esa-text-field only. Its value arrives in
 * $event.detail.value of the lowercase "change" event, on every keystroke.
 */
@Component({
  selector: 'app-site-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  imports: [EsaBadge],
  host: { class: 'site-list' },
  template: `
    <div class="site-list__tools">
      @if (items().length) {
        <esa-text-field
          class="site-list__search"
          size="sm"
          autocomplete="off"
          [label]="'Search ' + unitPlural()"
          [placeholder]="placeholder()"
          [value]="query()"
          (change)="onSearch($event)"
        ></esa-text-field>
      }
      <p class="site-list__count typography-body-xs" aria-live="polite">{{ count() }}</p>
    </div>
    <!-- While a new pick loads, the rows of the old one stay in place but cannot be used. -->
    <div #scroll class="site-list__scroll" [class.site-list__scroll--busy]="busy()" [attr.inert]="busy() ? '' : null">
      @if (view().groups.length) {
        <ul class="site-list__groups" role="list">
          @for (group of view().groups; track group.label) {
            <li class="site-list__group">
              @if (group.label) {
                <h4 class="site-list__heading typography-label-xs-strong">
                  {{ group.label }} <span class="site-list__n">({{ group.rows.length.toLocaleString('en-US') }})</span>
                </h4>
              }
              <ul class="site-list__rows" role="list">
                @for (item of group.rows; track item.key) {
                  <li>
                    <button
                      type="button"
                      class="site-list__row"
                      [attr.data-key]="item.key"
                      [attr.aria-current]="item.key === selectedKey() ? 'true' : null"
                      [disabled]="!item.mapped"
                      (click)="siteSelect.emit(item.key)"
                    >
                      <!-- The dot color is data: the status or rating color of this row. -->
                      <span class="site-list__dot" [style.--site-dot]="item.color" aria-hidden="true"></span>
                      <span class="site-list__text">
                        <span class="site-list__name typography-label-sm">
                          {{ item.name }}
                          @if (!item.mapped) {
                            <esa-badge value="Not mapped" size="xs" />
                          }
                        </span>
                        @if (item.meta) {
                          <span class="site-list__meta typography-body-xs">{{ item.meta }}</span>
                        }
                      </span>
                    </button>
                  </li>
                }
              </ul>
            </li>
          }
        </ul>
      } @else if (!message()) {
        <p class="site-list__empty typography-body-sm">{{ emptyText() }}</p>
      }
    </div>
  `,
  styleUrl: './site-list.scss',
})
export class SiteList {
  /** Rows from siteListItems or areaListItems. */
  readonly items = input<ListItem[]>([]);
  /** The groups rows file under, in display order, from siteGroups or areaGroups. */
  readonly groups = input<ListGroup[]>([]);
  /** What one row is called: "site", "station", "assessment unit". */
  readonly unit = input('site');
  /** The key of the row marked current, or null. */
  readonly selectedKey = input<string | null>(null);
  /** Replaces the count line while loading or after an error. */
  readonly message = input('');
  /** True while the rows on screen are about to be replaced; they dim and stop answering. */
  readonly busy = input(false);

  /** The key of the row the reader clicked. */
  readonly siteSelect = output<string>();

  protected readonly query = signal('');
  protected readonly unitPlural = computed(() => plural(2, this.unit()));
  /** An example of a well-formed search: the first name in the list. */
  protected readonly placeholder = computed(() => {
    const first = this.items()[0]?.name;
    return first ? `e.g. ${first}` : '';
  });

  protected readonly view = computed<{ groups: GroupView[]; shown: number }>(() => {
    const query = this.query().trim().toLowerCase();
    const items = this.items();
    const groups = this.groups().length ? this.groups() : [{ value: null, label: '' }];
    const out: GroupView[] = [];
    let shown = 0;
    for (const group of groups) {
      const all = items.filter((item) => item.group === group.value);
      const rows = query ? all.filter((item) => (item.search || item.name.toLowerCase()).includes(query)) : all;
      if (!rows.length) continue;
      shown += rows.length;
      out.push({ label: group.label, rows });
    }
    return { groups: out, shown };
  });

  protected readonly count = computed(() => {
    if (this.message()) return this.message();
    const total = this.items().length;
    if (!total) return '';
    return countLine(total, this.view().shown, !!this.query().trim(), this.unit());
  });

  protected readonly emptyText = computed(() =>
    this.items().length ? `No ${this.unitPlural()} match the search.` : `No ${this.unitPlural()} to list.`,
  );

  private readonly scroll = viewChild.required<ElementRef<HTMLDivElement>>('scroll');
  private readonly injector = inject(Injector);

  protected onSearch(event: Event): void {
    this.query.set((event as CustomEvent<{ value?: string }>).detail?.value ?? '');
  }

  /**
   * Bring a row into view inside the list without moving the page. A row hidden by the
   * search clears the search first, so the selection is always visible.
   */
  reveal(key: string): void {
    const item = this.items().find((i) => i.key === key);
    if (!item) return;
    const query = this.query().trim().toLowerCase();
    if (query && !(item.search || item.name.toLowerCase()).includes(query)) this.query.set('');
    // The row may not be in the DOM until the cleared search has rendered.
    afterNextRender(() => this.scrollTo(key), { injector: this.injector });
  }

  private scrollTo(key: string): void {
    const scroll = this.scroll().nativeElement;
    const row = [...scroll.querySelectorAll<HTMLButtonElement>('.site-list__row')].find((r) => r.dataset['key'] === key);
    if (!row) return;
    const heading = row.closest('.site-list__group')?.querySelector<HTMLElement>('.site-list__heading');
    const headingHeight = heading ? heading.offsetHeight : 0;
    const rowRect = row.getBoundingClientRect();
    const scrollRect = scroll.getBoundingClientRect();
    const top = rowRect.top - scrollRect.top;
    const bottom = rowRect.bottom - scrollRect.top;
    if (top < headingHeight || bottom > scroll.clientHeight) {
      const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scroll.scrollTo({ top: scroll.scrollTop + top - headingHeight - 8, behavior: still ? 'auto' : 'smooth' });
    }
  }
}
