import { ChangeDetectionStrategy, Component } from '@angular/core';

// PLACEHOLDER test page at /dev/map, owned by the map panel work: a sites map, an
// areas map with a year pick, and an overlay.
@Component({
  selector: 'app-sites-panel-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="typography-body-md">Map panel test page placeholder.</p>`,
})
export class SitesPanelDemo {}
