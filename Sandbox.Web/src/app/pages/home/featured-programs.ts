import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { MonitoringProgramSummary } from '../../api/models';
import { EsaButton } from '../../ecology/esa-button';

/** How many photo cards the strip shows. Two rows of three beside the map. */
export const FEATURED_SHOWN = 6;

/**
 * Up to `count` featured programs with a key photo, one per category first so the strip
 * shows the range of what is monitored, then the rest in list order.
 */
export function pickFeatured(programs: readonly MonitoringProgramSummary[], count: number = FEATURED_SHOWN): MonitoringProgramSummary[] {
  const pool = programs.filter((p) => p.IsFeatured && p.KeyPhotoUrl);
  const picked: MonitoringProgramSummary[] = [];
  const seen = new Set<number>();
  for (const program of pool) {
    if (picked.length >= count) break;
    if (seen.has(program.CategoryID)) continue;
    seen.add(program.CategoryID);
    picked.push(program);
  }
  for (const program of pool) {
    if (picked.length >= count) break;
    if (!picked.includes(program)) picked.push(program);
  }
  return picked;
}

/**
 * Featured Programs under the category cards on the home page: photo links straight to
 * program pages, and "All N" to the featured programs in the list below.
 *
 *   <app-featured-programs [programs]="all" (hover)="..." (leave)="..." (showAll)="..." />
 *
 * hover emits the program under the pointer or focus, which the page shows on the map.
 */
@Component({
  selector: 'app-featured-programs',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EsaButton],
  templateUrl: './featured-programs.html',
  styleUrl: './featured-programs.scss',
})
export class FeaturedPrograms {
  readonly programs = input.required<readonly MonitoringProgramSummary[]>();

  readonly hover = output<MonitoringProgramSummary>();
  readonly leave = output<void>();
  /** "All N": the page shows the featured programs in the All Programs list. */
  readonly showAll = output<void>();

  protected readonly shown = computed(() => pickFeatured(this.programs()));
  protected readonly total = computed(() => this.programs().filter((p) => p.IsFeatured).length);
  protected readonly failed = signal<ReadonlySet<number>>(new Set());

  protected markFailed(id: number): void {
    this.failed.update((ids) => new Set([...ids, id]));
  }
}
