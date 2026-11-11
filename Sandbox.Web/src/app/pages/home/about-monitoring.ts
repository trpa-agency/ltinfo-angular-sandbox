import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { CategoryGroup, spellPercent } from './home-model';

/**
 * The About Monitoring section of the home page: a lead paragraph, each threshold
 * category's goal (CategoryDescription) with a link that opens the category on the map,
 * and the two data sources.
 */
@Component({
  selector: 'app-about-monitoring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './about-monitoring.html',
  styleUrl: './about-monitoring.scss',
})
export class AboutMonitoring {
  readonly groups = input.required<readonly CategoryGroup[]>();

  /** The goal text, with "25%" written out as "25 percent" per the house style. */
  protected readonly goal = spellPercent;
}
