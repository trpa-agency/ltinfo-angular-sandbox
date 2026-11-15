import { ChangeDetectionStrategy, Component, DestroyRef, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { RouterLink } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import type { MonitoringProgramSummary } from '../../api/models';
import { SandboxApiService } from '../../api/sandbox-api.service';
import { EsaStat } from '../../ecology/esa-stat';
import { Headline, TREND_HEIGHT, TREND_WIDTH, Trend, measureHeadline, trend } from '../../lib/headline';
import { HOME_HEADLINE_PROGRAMS } from '../../lib/home-page';
import { queryPanelRows } from '../../lib/measures';

/** One headline tile: a program, and its figure once the first chart's rows have arrived. */
interface Entry {
  programId: number;
  name: string;
  /** loading until the rows arrive; none when the program has no headline or its data failed. */
  status: 'loading' | 'ready' | 'none';
  headline: Headline | null;
  trend: Trend | null;
}

export type HomeHeadlinesState = 'loading' | 'ready' | 'empty';

/**
 * Headline Measures on the home page: for each program in HOME_HEADLINE_PROGRAMS, the latest
 * value of its first chart, read live from the same service the program page reads, with the
 * record as a small trend line and a link to the program. It is the figure the program's own
 * header leads with (lib/headline.ts), so the two never disagree.
 *
 *   <app-home-headlines [programs]="programs" />
 *
 * A program with no headline, or whose data does not load, is left out. For tests the host
 * carries data-state: loading until every tile has settled, then ready, or empty when none
 * has a figure.
 */
@Component({
  selector: 'app-home-headlines',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EsaStat, RouterLink],
  host: { '[attr.data-state]': 'state()' },
  template: `
    <!-- mon-lego-checked: esa-stat carries each figure. The tile around it is a plain bordered
         box, because the whole tile is not a link and esa-card's header and footer frame adds
         nothing here. Ecology has no sparkline lego, so the trend line is the same inline SVG
         the program header draws; it is decorative, since the program page charts the record. -->
    @if (state() === 'empty') {
      <p class="headlines__none typography-body-sm" role="status">The headline measures could not be loaded.</p>
    } @else {
      <ul class="headlines" role="list">
        @for (tile of tiles(); track tile.programId) {
          <li class="headline" [attr.data-program-id]="tile.programId" [attr.data-status]="tile.status">
            @if (tile.headline; as figure) {
              <div class="headline__figure">
                <esa-stat [value]="figure.value" [label]="figure.label" [sub]="figure.sub" />
                @if (tile.trend; as line) {
                  <svg class="trend" [attr.viewBox]="viewBox" aria-hidden="true" focusable="false">
                    @if (line.standardY !== null) {
                      <line class="trend__standard" x1="0" [attr.x2]="width" [attr.y1]="line.standardY" [attr.y2]="line.standardY" />
                    }
                    <polyline class="trend__line" [attr.points]="line.line" />
                    <circle class="trend__end" [attr.cx]="line.end.x" [attr.cy]="line.end.y" r="2" />
                  </svg>
                }
              </div>
            } @else {
              <p class="headline__wait typography-body-sm" role="status">Loading the latest value.</p>
            }
            <a class="headline__link typography-label-md" [routerLink]="['/programs', tile.programId]">{{ tile.name }}</a>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './home-headlines.scss',
})
export class HomeHeadlines {
  /** Every program, for the names on the tiles. */
  readonly programs = input.required<readonly MonitoringProgramSummary[]>();

  private readonly api = inject(SandboxApiService);
  private readonly entries = signal<readonly Entry[]>([]);
  private started = false;
  private destroyed = false;

  protected readonly width = TREND_WIDTH;
  protected readonly viewBox = `0 0 ${TREND_WIDTH} ${TREND_HEIGHT}`;

  /** The tiles on the page: the ones still loading and the ones with a figure. */
  protected readonly tiles = computed(() => this.entries().filter((entry) => entry.status !== 'none'));

  /** True once the tiles are listed, so an empty list reads as empty and not as still loading. */
  private readonly listed = signal(false);

  protected readonly state = computed<HomeHeadlinesState>(() => {
    const entries = this.entries();
    if (!this.listed() || entries.some((entry) => entry.status === 'loading')) return 'loading';
    return entries.some((entry) => entry.status === 'ready') ? 'ready' : 'empty';
  });

  constructor() {
    effect(() => {
      const programs = this.programs();
      untracked(() => {
        if (this.started) return;
        this.started = true;
        void this.load(programs);
      });
    });
    inject(DestroyRef).onDestroy(() => (this.destroyed = true));
  }

  private async load(programs: readonly MonitoringProgramSummary[]): Promise<void> {
    const byId = new Map(programs.map((program) => [program.MonitoringProgramID, program]));
    const listed = HOME_HEADLINE_PROGRAMS.filter((id) => byId.has(id));
    this.entries.set(
      listed.map((id) => ({
        programId: id,
        name: byId.get(id)!.MonitoringProgramName,
        status: 'loading',
        headline: null,
        trend: null,
      })),
    );
    this.listed.set(true);

    let configs;
    try {
      configs = await firstValueFrom(this.api.getDashboardConfigs());
    } catch {
      // The browser has logged the request; the section says the figures could not be loaded.
      this.settleAll();
      return;
    }
    await Promise.all(
      listed.map(async (id) => {
        const measure = configs.find((config) => config.MonitoringProgramID === id)?.DashboardConfig?.measures?.[0];
        let headline: Headline | null = null;
        if (measure) {
          try {
            headline = measureHeadline(measure, await queryPanelRows(measure, null));
          } catch (error: unknown) {
            console.warn(`${measure.title}: ${error instanceof Error ? error.message : String(error)}`);
          }
        }
        this.settle(id, headline);
      }),
    );
  }

  private settle(id: number, headline: Headline | null): void {
    if (this.destroyed) return;
    this.entries.update((entries) =>
      entries.map((entry) =>
        entry.programId === id
          ? {
              ...entry,
              status: headline ? 'ready' : 'none',
              headline,
              trend: headline ? trend(headline.points, headline.threshold) : null,
            }
          : entry,
      ),
    );
  }

  private settleAll(): void {
    if (this.destroyed) return;
    this.entries.update((entries) => entries.map((entry) => ({ ...entry, status: 'none' })));
  }
}
