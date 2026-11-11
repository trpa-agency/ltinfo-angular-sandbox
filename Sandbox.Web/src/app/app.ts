import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterOutlet } from '@angular/router';
import { catchError, filter, map, merge, of, switchMap, timer } from 'rxjs';

import { LoadState, failed, ready } from './api/load-state';
import { HealthStatus } from './api/models';
import { SandboxApiService } from './api/sandbox-api.service';
import { EsaBadge } from './ecology/esa-badge';

// The shell: the navy LT Info bar, the routed page, and a footer line that
// asks the API for /health so anyone can see that Angular, the API, and
// SQL Server are connected.
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterOutlet, EsaBadge],
  templateUrl: './app.html',
  styleUrl: './app.scss',
})
export class App {
  private readonly api = inject(SandboxApiService);

  protected readonly health = signal<LoadState<HealthStatus>>({ status: 'loading' });

  private readonly router = inject(Router);

  constructor() {
    // Ask at start, on every route change, and every 30 seconds, so the line
    // recovers on its own after the API or the database comes back.
    const navigations = this.router.events.pipe(filter((event) => event instanceof NavigationEnd));
    merge(timer(0, 30_000), navigations)
      .pipe(
        switchMap(() =>
          this.api.getHealth().pipe(
            map((health) => ready(health)),
            catchError((error: unknown) => of(failed<HealthStatus>(error))),
          ),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((state) => this.health.set(state));
  }
}
