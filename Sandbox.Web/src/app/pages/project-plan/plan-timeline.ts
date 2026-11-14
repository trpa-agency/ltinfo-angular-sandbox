import { ChangeDetectionStrategy, Component } from '@angular/core';

import { assignLanes, monthStarts, monthTickLabel, timelineX, trpaDate } from '../../lib/plan-dates';
import { PLAN, TIMELINE_MARKERS, WORKSTREAMS, workstreamById } from '../../lib/project-plan';

// mon-lego-checked: no Ecology component draws a timeline. This is inline SVG built from
// TIMELINE_MARKERS in lib/project-plan.ts, styled with tokens. Positions and label lanes come
// from lib/plan-dates.ts, so moving a milestone's date moves its marker and nothing here.

/** The viewBox, and the month band the markers sit on. */
const WIDTH = 1000;
const HEIGHT = 222;
const X0 = 60;
const X1 = 930;
const BAND_TOP = 106;
const BAND_BOTTOM = 130;
const DOT = 5;

/** Labels in one lane are at least this far apart, center to center: the widest label and a gap. */
const LABEL_GAP = 110;

/**
 * Where a label's two lines sit, by lane. Lanes fill in this order: just above the band, just
 * below it, farther above, farther below. A label takes a far lane only when a neighbor is
 * within LABEL_GAP, and its text has a background halo in case a stem passes behind it.
 */
const LANES = [
  { above: true, name: 74, date: 90 },
  { above: false, name: 152, date: 168 },
  { above: true, name: 30, date: 46 },
  { above: false, name: 196, date: 212 },
] as const;

interface Mark {
  key: string;
  x: number;
  dotY: number;
  stemFrom: number;
  stemTo: number;
  nameY: number;
  dateY: number;
  label: string;
  date: string;
  color: string | null;
}

interface Tick {
  x: number;
  label: string;
  /** False for the tick at the right end, which has no room for a label. */
  labeled: boolean;
}

const xOf = (iso: string): number => timelineX(iso, PLAN.timelineStart, PLAN.timelineEnd, X0, X1);

const buildMarks = (): Mark[] => {
  const xs = TIMELINE_MARKERS.map((m) => xOf(m.date));
  const lanes = assignLanes(xs, LABEL_GAP, LANES.length);
  return TIMELINE_MARKERS.map((m, i) => {
    const lane = LANES[lanes[i]];
    return {
      key: `${m.date}|${m.label}`,
      x: xs[i],
      dotY: lane.above ? BAND_TOP : BAND_BOTTOM,
      stemFrom: lane.above ? BAND_TOP - DOT : BAND_BOTTOM + DOT,
      stemTo: lane.above ? lane.date + 5 : lane.name - 13,
      nameY: lane.name,
      dateY: lane.date,
      label: m.label,
      date: trpaDate(m.date),
      color: m.owner ? workstreamById(m.owner).color : null,
    };
  });
};

const buildTicks = (): Tick[] =>
  monthStarts(PLAN.timelineStart, PLAN.timelineEnd).map((iso, i, all) => ({
    x: xOf(iso),
    label: monthTickLabel(iso, i === 0),
    labeled: i < all.length - 1,
  }));

/** The timeline in words, for a reader who cannot see the drawing. */
const describe = (): string =>
  TIMELINE_MARKERS.map((m) => {
    const what = m.detail === m.label ? m.label : `${m.label}, ${m.detail}`;
    return `${trpaDate(m.date, { year: true })}: ${what}`;
  }).join('. ') + '.';

@Component({
  selector: 'app-plan-timeline',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="tl" tabindex="0" role="region" aria-label="Timeline, scrolls sideways on a narrow screen">
      <svg class="tl__svg" [attr.viewBox]="viewBox" role="img" aria-labelledby="plan-tl-title plan-tl-desc">
        <title id="plan-tl-title">Redesign timeline, November 2026 to June 2027</title>
        <desc id="plan-tl-desc">{{ description }}</desc>

        <rect class="tl__band" [attr.x]="x0" [attr.y]="bandTop" [attr.width]="x1 - x0" [attr.height]="bandBottom - bandTop" rx="4" />
        @for (t of ticks; track t.x; let first = $first) {
          @if (!first && t.labeled) {
            <line class="tl__tick" [attr.x1]="t.x" [attr.x2]="t.x" [attr.y1]="bandTop" [attr.y2]="bandBottom" />
          }
          @if (t.labeled) {
            <text class="tl__month typography-label-xs" [attr.x]="t.x + 6" [attr.y]="bandTop + 16">{{ t.label }}</text>
          }
        }

        @for (m of marks; track m.key) {
          <g class="tl__mark" [style.--plan-mark]="m.color">
            <line class="tl__stem" [attr.x1]="m.x" [attr.x2]="m.x" [attr.y1]="m.stemFrom" [attr.y2]="m.stemTo" />
            <circle class="tl__dot" [attr.cx]="m.x" [attr.cy]="m.dotY" [attr.r]="dot" />
            <text class="tl__name typography-label-sm-strong" [attr.x]="m.x" [attr.y]="m.nameY" text-anchor="middle">{{ m.label }}</text>
            <text class="tl__date typography-label-sm" [attr.x]="m.x" [attr.y]="m.dateY" text-anchor="middle">{{ m.date }}</text>
          </g>
        }
      </svg>
    </div>

    <ul class="tl-key typography-label-sm" aria-label="Marker colors by workstream">
      @for (w of workstreams; track w.id) {
        <li class="tl-key__item">
          <span class="tl-key__dot" aria-hidden="true" [style.--plan-mark]="w.color"></span>
          {{ w.name }}
        </li>
      }
    </ul>
  `,
  styleUrl: './plan-timeline.scss',
})
export class PlanTimeline {
  protected readonly viewBox = `0 0 ${WIDTH} ${HEIGHT}`;
  protected readonly x0 = X0;
  protected readonly x1 = X1;
  protected readonly bandTop = BAND_TOP;
  protected readonly bandBottom = BAND_BOTTOM;
  protected readonly dot = DOT;

  protected readonly marks = buildMarks();
  protected readonly ticks = buildTicks();
  protected readonly description = describe();
  protected readonly workstreams = WORKSTREAMS;
}
