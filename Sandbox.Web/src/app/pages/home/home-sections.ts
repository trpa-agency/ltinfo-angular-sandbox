import { Injectable, signal } from '@angular/core';
import { Subject } from 'rxjs';

/**
 * The three sections of the home page, in page order. The id is also the URL fragment, and
 * each label is the section's own heading, so no two nav items read as the same place.
 */
export type HomeSectionId = 'categories' | 'all-programs' | 'about';

export const HOME_SECTIONS: readonly { id: HomeSectionId; label: string }[] = [
  { id: 'categories', label: 'Categories' },
  { id: 'all-programs', label: 'All Programs' },
  { id: 'about', label: 'About Monitoring' },
];

export const isHomeSection = (value: string | null | undefined): value is HomeSectionId =>
  HOME_SECTIONS.some((section) => section.id === value);

/**
 * The link between the shell's nav row and the home page. The home page writes the
 * section in view (scroll spy); the nav reads it to mark the active item. A nav click
 * asks the home page to scroll to a section and move focus to its heading, which also
 * works when the URL already ends in that fragment and the router would do nothing.
 */
@Injectable({ providedIn: 'root' })
export class HomeSections {
  /** The section in view, or null when the home page is not on screen. */
  readonly active = signal<HomeSectionId | null>(null);
  /** Scroll requests from the nav. */
  readonly requests = new Subject<HomeSectionId>();

  go(id: HomeSectionId): void {
    this.requests.next(id);
  }
}
