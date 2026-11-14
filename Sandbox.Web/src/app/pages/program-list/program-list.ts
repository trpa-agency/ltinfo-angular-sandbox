import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Category, MonitoringProgramSummary, Template } from '../../api/models';
import { TEMPLATE_LABELS } from '../../dashboard/templates/template-info';
import { EsaBadge } from '../../ecology/esa-badge';
import { EsaButton } from '../../ecology/esa-button';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import { StaffMode } from '../../staff-mode';
import { FeaturedFilter, LayoutFilter, ProgramFilters } from './program-filters';

/** Rows the unfiltered All Programs list shows before "Show all". */
export const PROGRAM_LIST_CAP = 12;

// The All Programs list: the four filters, the table, and the record count, in one
// frame. It is a section of the home page, which loads the data once, passes it in, and
// owns the loading and error states; the hero above carries the totals. The home page
// calls showCategory() for "Show in the list".
@Component({
  selector: 'app-program-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EsaBadge, EsaButton, EsaEmptyState, ProgramFilters],
  templateUrl: './program-list.html',
  styleUrl: './program-list.scss',
})
export class ProgramList {
  /** The Layout column and filter are staff mode only. */
  protected readonly staff = inject(StaffMode);
  readonly categories = input.required<Category[]>();
  readonly programs = input.required<MonitoringProgramSummary[]>();

  // The four filters. ProgramFilters writes them; `filtered` reads them.
  protected readonly search = signal('');
  protected readonly categoryId = signal('');
  protected readonly layout = signal<LayoutFilter>('');
  protected readonly featured = signal<FeaturedFilter>('all');

  /** The unfiltered list shows this many rows until the reader asks for the rest. */
  protected readonly cap = PROGRAM_LIST_CAP;
  /** True once the reader has asked for every row. */
  protected readonly expanded = signal(false);

  /** Programs whose key photo file did not load; their rows show the empty frame instead. */
  protected readonly failedPhotos = signal<ReadonlySet<number>>(new Set());

  /** What a reader sees for each stored layout value. */
  protected readonly layoutLabels = TEMPLATE_LABELS;

  private readonly data = computed(() => ({
    categories: this.categories(),
    programs: this.programs(),
  }));

  /** How many programs use each layout, counted over the whole dataset. */
  protected readonly layoutCounts = computed<Record<Template, number>>(() => {
    const counts: Record<Template, number> = { map: 0, charts: 0, context: 0 };
    for (const program of this.data().programs) counts[program.Template] += 1;
    return counts;
  });

  protected readonly filtered = computed(() => {
    const text = this.search().trim().toLowerCase();
    const categoryId = this.categoryId();
    const layout = this.layout();
    const featuredOnly = this.featured() === 'featured';
    return this.data().programs.filter(
      (program) =>
        (!text || program.MonitoringProgramName.toLowerCase().includes(text)) &&
        (!categoryId || String(program.CategoryID) === categoryId) &&
        (!layout || program.Template === layout) &&
        (!featuredOnly || program.IsFeatured),
    );
  });

  /** True when any filter narrows the list. A filtered list is short and is shown whole. */
  protected readonly filtering = computed(
    () => !!this.search().trim() || !!this.categoryId() || !!this.layout() || this.featured() === 'featured',
  );

  /**
   * The rows on the page. The whole list is 111 rows, about 6,000 px, and sat between the
   * reader and About Monitoring; unfiltered it now shows the first rows and a button for the
   * rest. A filter, or the button, shows every match.
   */
  protected readonly visible = computed(() => {
    const rows = this.filtered();
    return this.filtering() || this.expanded() || rows.length <= this.cap ? rows : rows.slice(0, this.cap);
  });

  /** Every program of one category: the other three filters are cleared so none is hidden. */
  showCategory(categoryId: number): void {
    this.clearFilters();
    this.categoryId.set(String(categoryId));
  }

  /** Every featured program: the other three filters are cleared so none is hidden. */
  showFeatured(): void {
    this.clearFilters();
    this.featured.set('featured');
  }

  protected clearFilters(): void {
    this.search.set('');
    this.categoryId.set('');
    this.layout.set('');
    this.featured.set('all');
  }

  protected photoFailed(programId: number): void {
    this.failedPhotos.update((ids) => new Set([...ids, programId]));
  }
}
