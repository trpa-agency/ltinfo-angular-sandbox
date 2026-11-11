import { ChangeDetectionStrategy, Component } from '@angular/core';

// PLACEHOLDER test page at /dev/charts, owned by the chart panel work: every chart
// shape the panel supports, each from a real measure.
@Component({
  selector: 'app-chart-panel-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<p class="typography-body-md">Chart panel test page placeholder.</p>`,
})
export class ChartPanelDemo {}
