import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { MonitoringProgramSummary } from '../../api/models';
import { EsaButton } from '../../ecology/esa-button';
import { CategoryGroup, formatCount, matchedPartner } from './home-model';

/**
 * One category card: the icon, the name, the program and mapped site counts, a line on what
 * the category covers, and a program list that drops down when the card is open.
 *
 *   <app-category-card [group]="g" [programs]="shown" [open]="..." (toggle)="..." (showList)="..." />
 */
@Component({
  selector: 'app-category-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, EsaButton],
  templateUrl: './category-card.html',
  styleUrl: './category-card.scss',
})
export class CategoryCard {
  readonly group = input.required<CategoryGroup>();
  /** The programs to list: all of them, or the ones that match the search. */
  readonly programs = input.required<readonly MonitoringProgramSummary[]>();
  /** The search text, so a program matched by a partner name can say which partner. */
  readonly query = input('');
  readonly open = input(false);

  readonly toggle = output<void>();
  /** "Show these programs in the list": the page filters All Programs to this category. */
  readonly showList = output<void>();

  protected readonly dropId = computed(() => `programs-${this.group().category.Folder}`);
  protected readonly formatCount = formatCount;
  protected readonly partner = (program: MonitoringProgramSummary): string | null =>
    matchedPartner(program, this.query());
}
