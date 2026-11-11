import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

import { creditLink } from './photo-viewer';

// The credit line of a photo: "Photo: Mike Vollmer". A credit that is a web
// address becomes a link that shows the name of the site instead of the whole URL.
@Component({
  selector: 'app-photo-credit',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @let site = link();
    @if (site) {
      <span class="credit">Photo: <a [href]="site.href" rel="noopener">{{ site.host }}</a></span>
    } @else if (credit()) {
      <span class="credit">Photo: {{ credit() }}</span>
    }
  `,
  styles: `
    :host {
      display: contents;
    }
    .credit {
      overflow-wrap: anywhere;
    }
    // Over the hero photo the text sits on a dark scrim, and so does the link.
    a {
      color: var(--photo-credit-link-color, var(--color-content-link));
    }
  `,
})
export class PhotoCredit {
  readonly credit = input<string | null>(null);
  protected readonly link = computed(() => creditLink(this.credit()));
}
