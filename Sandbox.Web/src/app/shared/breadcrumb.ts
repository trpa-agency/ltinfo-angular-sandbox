import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

/** One step of a breadcrumb. A step with no link is the page on screen. */
export interface Crumb {
  label: string;
  /** Router commands for the step's page; omit for the page on screen. */
  link?: readonly unknown[];
  /** A section of that page to land on. */
  fragment?: string;
}

// Where the page sits: Monitoring Programs, then the category, then the page itself. It
// replaces a lone back link, so the reader can go up one level or two in one click and can
// read where they are without the rail.
//
// mon-lego-checked: Ecology has no breadcrumb lego in the vendored set (badge, button, card,
// empty state, stat), so the list is custom: plain links in an ordered list, tokens only.
//
//   <app-breadcrumb [trail]="[{ label: 'Monitoring Programs', link: ['/'] }, { label: 'Ozone (O3)' }]" />
@Component({
  selector: 'app-breadcrumb',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  template: `
    <nav class="crumbs typography-label-md" aria-label="Breadcrumb">
      <ol class="crumbs__list">
        @for (crumb of trail(); track $index; let last = $last) {
          <li class="crumbs__item">
            @if (crumb.link) {
              <a [routerLink]="crumb.link" [fragment]="crumb.fragment">{{ crumb.label }}</a>
            } @else {
              <span [attr.aria-current]="last ? 'page' : null">{{ crumb.label }}</span>
            }
          </li>
        }
      </ol>
    </nav>
  `,
  styleUrl: './breadcrumb.scss',
})
export class Breadcrumb {
  readonly trail = input.required<readonly Crumb[]>();
}
