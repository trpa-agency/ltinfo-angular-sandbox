import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { forkJoin } from 'rxjs';

import type { Category, MonitoringProgramSummary } from '../../api/models';
import { SandboxApiService } from '../../api/sandbox-api.service';

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
 * The topic switcher beside the breadcrumb: a button that says how many programs share the
 * current program's category and opens the list of them, with the current one marked and a
 * way out to every topic on the home page. It replaces a rail that listed every category on
 * every page: the breadcrumb says where the page sits, and this moves the reader sideways.
 * It sits outside the page's loading states, so it stays put between programs.
 *
 *   <app-program-nav [currentId]="id" />
 */
@Component({
  selector: 'app-program-nav',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './program-nav.html',
  styleUrl: './program-nav.scss',
})
export class ProgramNav {
  /** The program on screen. */
  readonly currentId = input.required<number>();

  private readonly categories = signal<Category[]>([]);
  private readonly programs = signal<MonitoringProgramSummary[]>([]);
  protected readonly failed = signal(false);

  protected readonly groups = computed(() => programNavGroups(this.categories(), this.programs()));
  /** The current program's group and the program itself, once both lists are in. */
  protected readonly current = computed(() => {
    const id = this.currentId();
    const group = this.groups().find((g) => g.programs.some((p) => p.MonitoringProgramID === id));
    return group ? { category: group.category, program: group.programs.find((p) => p.MonitoringProgramID === id)!, programs: group.programs } : null;
  });
  /** The programs in the current program's category, itself included, alphabetical. */
  protected readonly siblings = computed(() => this.current()?.programs ?? []);

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
  }
}
