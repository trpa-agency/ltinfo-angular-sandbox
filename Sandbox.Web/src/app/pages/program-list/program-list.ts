import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Category, MonitoringProgramSummary, Template } from '../../api/models';
import { TEMPLATE_LABELS } from '../../dashboard/templates/template-info';
import { EsaBadge } from '../../ecology/esa-badge';
import { EsaButton } from '../../ecology/esa-button';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import { EsaStat } from '../../ecology/esa-stat';
import { FeaturedFilter, LayoutFilter, ProgramFilters } from './program-filters';

// The All Programs list: four tiles, the four filters, and the table. It is a section
// of the home page, which loads the data once and passes it in, and owns the loading
// and error states. The home page calls showCategory() for "Show these programs".
@Component({
  selector: 'app-program-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EsaBadge, EsaButton, EsaCard, EsaEmptyState, EsaStat, ProgramFilters],
  templateUrl: './program-list.html',
  styleUrl: './program-list.scss',
})
export class ProgramList {
  readonly categories = input.required<Category[]>();
  readonly programs = input.required<MonitoringProgramSummary[]>();

  // The four filters. ProgramFilters writes them; `filtered` reads them.
  protected readonly search = signal('');
  protected readonly categoryId = signal('');
  protected readonly layout = signal<LayoutFilter>('');
  protected readonly featured = signal<FeaturedFilter>('all');

  /** Programs whose key photo file did not load; their rows show the category swatch instead. */
  protected readonly failedPhotos = signal<ReadonlySet<number>>(new Set());

  /** What a reader sees for each stored layout value. */
  protected readonly layoutLabels = TEMPLATE_LABELS;

  private readonly data = computed(() => ({
    categories: this.categories(),
    programs: this.programs(),
  }));

  // The four tiles count the whole dataset, not the filtered rows.
  protected readonly stats = computed(() => {
    const { categories, programs } = this.data();
    return {
      programs: programs.length,
      categories: categories.length,
      featured: programs.filter((program) => program.IsFeatured).length,
      partnerLinks: programs.reduce((sum, program) => sum + program.PartnerCount, 0),
    };
  });

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

  /** Every program of one category: the other three filters are cleared so none is hidden. */
  showCategory(categoryId: number): void {
    this.clearFilters();
    this.categoryId.set(String(categoryId));
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
