import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import type { MonitoringProgramSummary } from '../../api/models';
import { EsaButton } from '../../ecology/esa-button';
import { CategoryGroup, formatCount, matchedPartner } from './home-model';

/**
 * One threshold category card: the icon, the name, the program and mapped site counts, and
 * a program list that drops down when the card is open.
 *
 *   <app-category-card [group]="g" [programs]="shown" [open]="..." [hot]="..."
 *     (toggle)="..." (hover)="..." (leave)="..." />
 *
 * hover emits null when the pointer or focus is on the card itself, and the program when it
 * is on one of the program links. The page turns those into the map highlight.
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
  /** True when this category's sites are the ones in color on the map. */
  readonly hot = input(false);

  readonly toggle = output<void>();
  readonly hover = output<MonitoringProgramSummary | null>();
  /** The pointer left a program link. */
  readonly leave = output<void>();
  /** "Show these programs in the list": the page filters All Programs to this category. */
  readonly showList = output<void>();

  protected readonly dropId = computed(() => `programs-${this.group().category.Folder}`);
  protected readonly formatCount = formatCount;
  protected readonly partner = (program: MonitoringProgramSummary): string | null =>
    matchedPartner(program, this.query());
}
