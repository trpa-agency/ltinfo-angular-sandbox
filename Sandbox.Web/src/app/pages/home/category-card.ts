import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { RouterLink } from '@angular/router';

import type { MonitoringProgramSummary } from '../../api/models';
import { EsaButton } from '../../ecology/esa-button';
import { CategoryGroup, formatCount } from './home-model';

/**
 * One threshold category card: the icon, the name, the program and mapped site counts, and
 * a program list that drops down when the card is open (or is always shown when listed).
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
  imports: [NgTemplateOutlet, RouterLink, EsaButton],
  templateUrl: './category-card.html',
  styleUrl: './category-card.scss',
})
export class CategoryCard {
  readonly group = input.required<CategoryGroup>();
  /** The programs to list: all of them, or the ones that match the search. */
  readonly programs = input.required<readonly MonitoringProgramSummary[]>();
  readonly open = input(false);
  /** True when this category's sites are the ones in color on the map. */
  readonly hot = input(false);
  /** Show every program with no disclosure: the directory layout. */
  readonly listed = input(false);

  readonly toggle = output<void>();
  readonly hover = output<MonitoringProgramSummary | null>();
  /** The pointer left a program link. */
  readonly leave = output<void>();
  /** "Show these programs in the list": the page filters All Programs to this category. */
  readonly showList = output<void>();

  protected readonly dropId = computed(() => `programs-${this.group().category.Folder}`);
  protected readonly formatCount = formatCount;
}
