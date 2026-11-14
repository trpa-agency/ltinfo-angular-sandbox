import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router } from '@angular/router';

import { EsaButton } from '../../ecology/esa-button';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';

// An address that is not a page. It says so and offers the way back, where the app used to
// send the reader to the home page without a word.
@Component({
  selector: 'app-not-found',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EsaButton, EsaCard, EsaEmptyState],
  template: `
    <esa-card>
      <div role="alert">
        <esa-empty-state [title]="'Page not found'" [description]="'This address is not a page on the Monitoring Dashboard.'">
          <esa-button appearance="outline" (click)="home()">Monitoring Programs</esa-button>
        </esa-empty-state>
      </div>
    </esa-card>
  `,
})
export class NotFound {
  private readonly router = inject(Router);

  protected home(): void {
    void this.router.navigate(['/']);
  }
}
