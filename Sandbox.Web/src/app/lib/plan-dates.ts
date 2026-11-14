/*
 * plan-dates.ts: dates for the Redesign Plan page (pages/project-plan). TRPA date style,
 * positions on the timeline axis, and the lane each timeline label sits in.
 *
 * Pure: no DOM and no clock, so the page reads the same on any day and the functions run
 * the same in a test. Dates are ISO calendar dates (YYYY-MM-DD), handled in UTC so a
 * reader's time zone cannot move a milestone by a day.
 */

/** TRPA style: abbreviate Jan., Feb., Aug., Sept., Oct., Nov., and Dec.; spell out the rest. */
const MONTHS = ['Jan.', 'Feb.', 'March', 'April', 'May', 'June', 'July', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'] as const;

const MS_PER_DAY = 86_400_000;

/** Parse YYYY-MM-DD to a UTC date. Throws on anything else, including Feb. 30. */
export const parseIsoDate = (iso: string): Date => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!match) throw new Error(`Not an ISO date (YYYY-MM-DD): ${iso}`);
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    throw new Error(`Not a calendar date: ${iso}`);
  }
  return date;
};

/** "Jan. 14" or, with the year, "Jan. 14, 2027". No ordinal suffix. */
export const trpaDate = (iso: string, options: { year?: boolean } = {}): string => {
  const date = parseIsoDate(iso);
  const text = `${MONTHS[date.getUTCMonth()]} ${date.getUTCDate()}`;
  return options.year ? `${text}, ${date.getUTCFullYear()}` : text;
};

/** Whole days from one ISO date to another. Negative when `to` is earlier. */
export const daysBetween = (from: string, to: string): number =>
  Math.round((parseIsoDate(to).getTime() - parseIsoDate(from).getTime()) / MS_PER_DAY);

/**
 * Where a date falls on a horizontal axis that runs from `x0` at `start` to `x1` at `end`.
 * Dates outside the span are clamped to the ends.
 */
export const timelineX = (iso: string, start: string, end: string, x0: number, x1: number): number => {
  const span = daysBetween(start, end);
  if (span <= 0) throw new Error(`Timeline end (${end}) must be after its start (${start})`);
  const fraction = Math.min(1, Math.max(0, daysBetween(start, iso) / span));
  return x0 + fraction * (x1 - x0);
};

/** The first of each month from `start` through `end`, for axis ticks. */
export const monthStarts = (start: string, end: string): string[] => {
  const first = parseIsoDate(start);
  const last = parseIsoDate(end);
  const out: string[] = [];
  let year = first.getUTCFullYear();
  let month = first.getUTCMonth();
  if (first.getUTCDate() !== 1) month += 1;
  for (;;) {
    const tick = new Date(Date.UTC(year, month, 1));
    if (tick.getTime() > last.getTime()) break;
    out.push(tick.toISOString().slice(0, 10));
    year = tick.getUTCFullYear();
    month = tick.getUTCMonth() + 1;
  }
  return out;
};

/** "Nov.", "Dec.", "Jan. 2027": the year shows on the first tick and on each January. */
export const monthTickLabel = (iso: string, isFirst: boolean): string => {
  const date = parseIsoDate(iso);
  const name = MONTHS[date.getUTCMonth()];
  return isFirst || date.getUTCMonth() === 0 ? `${name} ${date.getUTCFullYear()}` : `${name}`;
};

/**
 * Give each label a lane so that no two labels in the same lane sit closer than `minGap`.
 * `xs` must be in ascending order. Lanes are tried in order (0 first), so the caller
 * decides what a lane number means: the plan timeline draws 0 just above the axis,
 * 1 just below, 2 farther above, and 3 farther below. When every lane is taken the label
 * goes in the lane whose last label is farthest away.
 */
export const assignLanes = (xs: number[], minGap: number, laneCount = 4): number[] => {
  const lastX: number[] = Array.from({ length: laneCount }, () => Number.NEGATIVE_INFINITY);
  return xs.map((x) => {
    let lane = lastX.findIndex((last) => x - last >= minGap);
    if (lane === -1) {
      lane = lastX.reduce((best, last, index) => (last < (lastX[best] ?? last) ? index : best), 0);
    }
    lastX[lane] = x;
    return lane;
  });
};
