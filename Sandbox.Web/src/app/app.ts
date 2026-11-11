import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink, RouterOutlet } from '@angular/router';

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

  constructor() {
    this.api.getHealth().subscribe({
      next: (health) => this.health.set(ready(health)),
      error: (error: unknown) => this.health.set(failed(error)),
    });
  }
}
