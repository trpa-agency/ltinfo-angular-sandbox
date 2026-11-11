import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  input,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import type { Category, MonitoringProgramSummary } from '../../api/models';
import { SandboxApiService } from '../../api/sandbox-api.service';

/** Under this width the menu folds into one disclosure above the page instead of a rail beside it. */
export const PROGRAM_NAV_NARROW = '(max-width: 64rem)';

export interface ProgramNavGroup {
  category: Category;
  programs: MonitoringProgramSummary[];
}

/** Categories with programs, alphabetical, each with its programs alphabetical. */
export function programNavGroups(
  categories: readonly Category[],
  programs: readonly MonitoringProgramSummary[],
): ProgramNavGroup[] {
  const byName = (a: string, b: string): number => a.localeCompare(b, 'en');
  return [...categories]
    .sort((a, b) => byName(a.CategoryName, b.CategoryName))
    .map((category) => ({
      category,
      programs: programs
        .filter((p) => p.CategoryID === category.CategoryID)
        .sort((a, b) => byName(a.MonitoringProgramName, b.MonitoringProgramName)),
    }))
    .filter((group) => group.programs.length > 0);
}

/**
 * The rail menu beside a program page: every category with programs as a disclosure, the
 * current program's category open, and the current program marked. It sits outside the
 * page's loading states, so it stays put while the reader moves between programs.
 *
 *   <app-program-nav [currentId]="id" />
 */
@Component({
  selector: 'app-program-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  host: { '[class.is-narrow]': 'narrow()' },
  templateUrl: './program-nav.html',
  styleUrl: './program-nav.scss',
})
export class ProgramNav {
  /** The program on screen. */
  readonly currentId = input.required<number>();

  private readonly categories = signal<Category[]>([]);
  private readonly programs = signal<MonitoringProgramSummary[]>([]);
  protected readonly failed = signal(false);
  protected readonly narrow = signal(false);

  protected readonly groups = computed(() => programNavGroups(this.categories(), this.programs()));
  /** The current program's group and the program itself, once both lists are in. */
  protected readonly current = computed(() => {
    const id = this.currentId();
    const group = this.groups().find((g) => g.programs.some((p) => p.MonitoringProgramID === id));
    return group ? { category: group.category, program: group.programs.find((p) => p.MonitoringProgramID === id)! } : null;
  });

  constructor() {
    forkJoin([inject(SandboxApiService).getCategories(), inject(SandboxApiService).getPrograms()])
      .pipe(takeUntilDestroyed())
      .subscribe({
        next: ([categories, programs]) => {
          this.categories.set(categories);
          this.programs.set(programs);
        },
        error: () => this.failed.set(true),
      });

    const query = window.matchMedia(PROGRAM_NAV_NARROW);
    const update = (): void => this.narrow.set(query.matches);
    update();
    query.addEventListener('change', update);
    inject(DestroyRef).onDestroy(() => query.removeEventListener('change', update));
  }
}
