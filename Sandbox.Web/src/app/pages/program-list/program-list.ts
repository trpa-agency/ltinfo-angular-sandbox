import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import { LoadState, failed, ready } from '../../api/load-state';
import { Category, MonitoringProgramSummary, Template } from '../../api/models';
import { SandboxApiService } from '../../api/sandbox-api.service';
import { TEMPLATE_LABELS } from '../../dashboard/templates/template-info';
import { EsaBadge } from '../../ecology/esa-badge';
import { EsaButton } from '../../ecology/esa-button';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import { EsaStat } from '../../ecology/esa-stat';
import { FeaturedFilter, LayoutFilter, ProgramFilters } from './program-filters';

interface ListData {
  categories: Category[];
  programs: MonitoringProgramSummary[];
}

@Component({
  selector: 'app-program-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EsaBadge, EsaButton, EsaCard, EsaEmptyState, EsaStat, ProgramFilters],
  templateUrl: './program-list.html',
  styleUrl: './program-list.scss',
})
export class ProgramList {
  private readonly api = inject(SandboxApiService);

  protected readonly state = signal<LoadState<ListData>>({ status: 'loading' });

  // The four filters. ProgramFilters writes them; `filtered` reads them.
  protected readonly search = signal('');
  protected readonly categoryId = signal('');
  protected readonly layout = signal<LayoutFilter>('');
  protected readonly featured = signal<FeaturedFilter>('all');

  /** Programs whose key photo file did not load; their rows show the category swatch instead. */
  protected readonly failedPhotos = signal<ReadonlySet<number>>(new Set());

  /** What a reader sees for each stored layout value. */
  protected readonly layoutLabels = TEMPLATE_LABELS;

  private readonly data = computed<ListData>(() => {
    const state = this.state();
    return state.status === 'ready' ? state.data : { categories: [], programs: [] };
  });

  protected readonly categories = computed(() => this.data().categories);

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

  constructor() {
    this.load();
  }

  protected load(): void {
    this.state.set({ status: 'loading' });
    forkJoin({
      categories: this.api.getCategories(),
      programs: this.api.getPrograms(),
    }).subscribe({
      next: (data) => this.state.set(ready(data)),
      error: (error: unknown) => this.state.set(failed(error)),
    });
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
