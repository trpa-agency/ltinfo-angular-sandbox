import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { RouterLink } from '@angular/router';

import { EsaCard } from '../../ecology/esa-card';
import { CategoryGroup, spellPercent } from './home-model';

/**
 * The About Monitoring section of the home page: what the dashboard holds, where the data
 * come from, and each threshold category's goal (CategoryDescription) with a link that
 * opens the category on the map.
 */
@Component({
  selector: 'app-about-monitoring',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EsaCard],
  templateUrl: './about-monitoring.html',
  styleUrl: './about-monitoring.scss',
})
export class AboutMonitoring {
  readonly groups = input.required<readonly CategoryGroup[]>();

  /** The goal text, with "25%" written out as "25 percent" per the house style. */
  protected readonly goal = spellPercent;
}
