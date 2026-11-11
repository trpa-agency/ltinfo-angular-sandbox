import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { LoadState, describeError, failed, ready } from '../../api/load-state';
import { MonitoringProgramDetail } from '../../api/models';
import { SandboxApiService } from '../../api/sandbox-api.service';
import { EsaBadge } from '../../ecology/esa-badge';
import { EsaButton } from '../../ecology/esa-button';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';

@Component({
  selector: 'app-program-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EsaBadge, EsaButton, EsaCard, EsaEmptyState],
  templateUrl: './program-detail.html',
  styleUrl: './program-detail.scss',
})
export class ProgramDetail {
  private readonly api = inject(SandboxApiService);
  private readonly route = inject(ActivatedRoute);

  protected readonly state = signal<LoadState<MonitoringProgramDetail>>({ status: 'loading' });
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');

  constructor() {
    // Reload whenever the :id in the address changes.
    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        tap(() => {
          this.state.set({ status: 'loading' });
          this.saveError.set('');
        }),
        switchMap((id) =>
          this.api.getProgram(id).pipe(
            map((program) => ready(program)),
            catchError((error: unknown) => of(this.loadFailed(id, error))),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));
  }

  /**
   * The write path. PATCH the new value, then show what the API sends back,
   * which is the row as SQL Server now holds it. The page never flips the
   * value on its own, so what it shows is always the saved value.
   */
  protected toggleFeatured(program: MonitoringProgramDetail): void {
    this.saving.set(true);
    this.saveError.set('');
    this.api.setFeatured(program.MonitoringProgramID, !program.IsFeatured).subscribe({
      next: (saved) => {
        this.state.set(ready(saved));
        this.saving.set(false);
      },
      error: (error: unknown) => {
        this.saveError.set(`${describeError(error).title}. The change was not saved.`);
        this.saving.set(false);
      },
    });
  }

  private loadFailed(id: number, error: unknown): LoadState<MonitoringProgramDetail> {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return {
        status: 'error',
        title: `No monitoring program has ID ${id}`,
        description: 'Go back to the list and pick a program.',
      };
    }
    return failed(error);
  }
}
