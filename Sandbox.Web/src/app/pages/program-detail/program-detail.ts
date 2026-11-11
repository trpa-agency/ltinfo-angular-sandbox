import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { catchError, map, of, switchMap, tap } from 'rxjs';

import { LoadState, describeError, failed, ready } from '../../api/load-state';
import { MonitoringProgramDetail, Template } from '../../api/models';
import { SandboxApiService } from '../../api/sandbox-api.service';
import { PhotoLightbox } from '../../dashboard/photos/photo-lightbox';
import { PhotoViewer } from '../../dashboard/photos/photo-viewer';
import { ChartsTemplate } from '../../dashboard/templates/charts-template';
import { ContentTemplate } from '../../dashboard/templates/content-template';
import { MapTemplate } from '../../dashboard/templates/map-template';
import { parseTemplate } from '../../dashboard/templates/template-info';
import { EsaButton } from '../../ecology/esa-button';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import { LayoutControl } from './layout-control';

// One program. The page loads the program, picks one of the three templates
// (the saved Template, or the one named by ?template= as a preview), and keeps
// the two write paths: Save layout and the Featured button. Everything a
// reader sees of the program itself is drawn by the template.
@Component({
  selector: 'app-program-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RouterLink,
    ChartsTemplate,
    ContentTemplate,
    EsaButton,
    EsaCard,
    EsaEmptyState,
    LayoutControl,
    MapTemplate,
    PhotoLightbox,
  ],
  // One viewer per page: the hero, the gallery, and the larger view share it.
  providers: [PhotoViewer],
  templateUrl: './program-detail.html',
  styleUrl: './program-detail.scss',
})
export class ProgramDetail {
  private readonly api = inject(SandboxApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly viewer = inject(PhotoViewer);

  protected readonly state = signal<LoadState<MonitoringProgramDetail>>({ status: 'loading' });
  protected readonly saving = signal(false);
  protected readonly saveError = signal('');
  protected readonly savingLayout = signal(false);
  protected readonly layoutError = signal('');

  /** The layout named by ?template=, when it is one of the three. A preview: nothing is saved. */
  private readonly requested = toSignal(
    this.route.queryParamMap.pipe(map((params) => parseTemplate(params.get('template')))),
    { initialValue: parseTemplate(this.route.snapshot.queryParamMap.get('template')) },
  );

  /** The layout on screen: the preview when the address names one, else the saved layout. */
  protected readonly shown = computed<Template | null>(() => {
    const state = this.state();
    return state.status === 'ready' ? (this.requested() ?? state.data.Template) : null;
  });

  constructor() {
    // Reload whenever the :id in the address changes.
    this.route.paramMap
      .pipe(
        map((params) => Number(params.get('id'))),
        tap(() => {
          this.state.set({ status: 'loading' });
          this.saveError.set('');
          this.layoutError.set('');
        }),
        switchMap((id) =>
          this.api.getProgram(id).pipe(
            tap((program) =>
              this.viewer.setProgram(program.MonitoringProgramName, program.Images),
            ),
            map((program) => ready(program)),
            catchError((error: unknown) => of(this.loadFailed(id, error))),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.state.set(state));
  }

  /**
   * Shows another layout without saving it, by putting it in the address as
   * ?template=. Choosing the saved layout takes the parameter back out. The
   * address is the state, so a preview can be bookmarked, shared, and left
   * with the Back button.
   */
  protected preview(template: Template, saved: Template): void {
    this.layoutError.set('');
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { template: template === saved ? null : template },
      queryParamsHandling: 'merge',
    });
  }

  /** The second write path: PATCH the layout on screen, then drop ?template= because it is now the saved one. */
  protected saveLayout(program: MonitoringProgramDetail): void {
    const template = this.shown();
    if (!template || template === program.Template) return;
    this.savingLayout.set(true);
    this.layoutError.set('');
    this.api.setTemplate(program.MonitoringProgramID, template).subscribe({
      next: (saved) => {
        this.state.set(ready(saved));
        this.savingLayout.set(false);
        void this.router.navigate([], {
          relativeTo: this.route,
          queryParams: { template: null },
          queryParamsHandling: 'merge',
          replaceUrl: true,
        });
      },
      error: (error: unknown) => {
        this.layoutError.set(`${describeError(error).title}. The layout was not saved.`);
        this.savingLayout.set(false);
      },
    });
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
