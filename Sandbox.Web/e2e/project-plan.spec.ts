// The Redesign Plan page: the plan's dates and wording (in Node, against the pure code in
// src/app/lib), then the page itself. The page is static, so nothing here waits on a service.
import { expect as nodeExpect, test as nodeTest } from '@playwright/test';

import {
  assignLanes,
  daysBetween,
  monthStarts,
  monthTickLabel,
  parseIsoDate,
  timelineX,
  trpaDate,
} from '../src/app/lib/plan-dates';
import {
  ACTION_GROUPS,
  MEETING_GROUPS,
  MILESTONES,
  PHASES,
  PLAN,
  REVISIONS,
  STEWARDS,
  TIMELINE_MARKERS,
  VISION_GOALS,
  WORKSTREAMS,
  actionTally,
  milestonesOf,
} from '../src/app/lib/project-plan';
import { expect, test } from './support';

nodeTest.describe('Plan dates', () => {
  nodeTest('are written in TRPA style: seven months abbreviated, the rest spelled out', () => {
    nodeExpect(trpaDate('2026-11-12')).toBe('Nov. 12');
    nodeExpect(trpaDate('2027-01-01')).toBe('Jan. 1');
    nodeExpect(trpaDate('2026-09-30')).toBe('Sept. 30');
    nodeExpect(trpaDate('2027-03-25')).toBe('March 25');
    nodeExpect(trpaDate('2027-04-01')).toBe('April 1');
    nodeExpect(trpaDate('2027-06-30')).toBe('June 30');
    nodeExpect(trpaDate('2026-10-22', { year: true })).toBe('Oct. 22, 2026');
    nodeExpect(trpaDate('2027-05-12', { year: true })).toBe('May 12, 2027');
  });

  nodeTest('reject other formats and dates that do not exist', () => {
    nodeExpect(() => parseIsoDate('Nov 12, 2026')).toThrow();
    nodeExpect(() => parseIsoDate('2026-11-12T00:00:00Z')).toThrow();
    nodeExpect(() => parseIsoDate('2027-02-30')).toThrow();
  });

  nodeTest('map onto the timeline axis and clamp outside it', () => {
    nodeExpect(daysBetween('2026-11-01', '2027-01-01')).toBe(61);
    nodeExpect(daysBetween('2027-01-04', '2027-01-01')).toBe(-3);
    nodeExpect(timelineX('2026-11-01', '2026-11-01', '2027-07-01', 60, 930)).toBe(60);
    nodeExpect(timelineX('2027-07-01', '2026-11-01', '2027-07-01', 60, 930)).toBe(930);
    nodeExpect(timelineX('2026-10-01', '2026-11-01', '2027-07-01', 60, 930)).toBe(60);
    nodeExpect(timelineX('2027-12-01', '2026-11-01', '2027-07-01', 60, 930)).toBe(930);
    nodeExpect(() => timelineX('2027-01-01', '2027-07-01', '2026-11-01', 0, 100)).toThrow();
  });

  nodeTest('give one tick a month, with the year on the first tick and on January', () => {
    nodeExpect(monthStarts('2026-11-01', '2027-02-01')).toEqual(['2026-11-01', '2026-12-01', '2027-01-01', '2027-02-01']);
    nodeExpect(monthStarts('2026-11-12', '2027-01-15')).toEqual(['2026-12-01', '2027-01-01']);
    nodeExpect(monthTickLabel('2026-11-01', true)).toBe('Nov. 2026');
    nodeExpect(monthTickLabel('2026-12-01', false)).toBe('Dec.');
    nodeExpect(monthTickLabel('2027-01-01', false)).toBe('Jan. 2027');
    nodeExpect(monthTickLabel('2027-04-01', false)).toBe('April');
  });

  nodeTest('labels that would collide move to another lane', () => {
    nodeExpect(assignLanes([0, 200, 400], 100)).toEqual([0, 0, 0]);
    nodeExpect(assignLanes([0, 10, 20, 200], 100)).toEqual([0, 1, 2, 0]);
    // With every lane taken, the label goes where its neighbor is farthest away.
    nodeExpect(assignLanes([0, 1, 2], 100, 2)).toEqual([0, 1, 0]);
  });

  nodeTest('the plan timeline needs no more than three lanes, and no lane is crowded', () => {
    const xs = TIMELINE_MARKERS.map((m) => timelineX(m.date, PLAN.timelineStart, PLAN.timelineEnd, 60, 930));
    const lanes = assignLanes(xs, 110);
    nodeExpect(Math.max(...lanes)).toBeLessThanOrEqual(2);
    const last = new Map<number, number>();
    xs.forEach((x, i) => {
      const previous = last.get(lanes[i]);
      if (previous !== undefined) nodeExpect(x - previous).toBeGreaterThanOrEqual(110);
      last.set(lanes[i], x);
    });
  });
});

nodeTest.describe('Plan data', () => {
  nodeTest('every date parses and every marker is on the timeline axis', () => {
    for (const iso of [PLAN.updated, PLAN.revised, PLAN.signed, PLAN.launch, PLAN.workOrderEnd]) {
      nodeExpect(() => parseIsoDate(iso)).not.toThrow();
    }
    for (const w of WORKSTREAMS) for (const entry of w.log) nodeExpect(() => parseIsoDate(entry.date)).not.toThrow();
    for (const marker of TIMELINE_MARKERS) {
      nodeExpect(daysBetween(PLAN.timelineStart, marker.date)).toBeGreaterThanOrEqual(0);
      nodeExpect(daysBetween(marker.date, PLAN.timelineEnd)).toBeGreaterThanOrEqual(0);
    }
    const dates = TIMELINE_MARKERS.map((m) => m.date);
    nodeExpect(dates).toEqual([...dates].sort());
  });

  nodeTest('milestones are numbered in date order and each workstream delivers at least one', () => {
    nodeExpect(MILESTONES.filter((m) => m.kind === 'milestone').map((m) => m.number)).toEqual([1, 2, 3, 4, 5, 6]);
    const dates = MILESTONES.map((m) => m.date);
    nodeExpect(dates).toEqual([...dates].sort());
    nodeExpect(MILESTONES.find((m) => m.kind === 'final')?.date).toBe(PLAN.launch);
    nodeExpect(WORKSTREAMS.map((w) => w.id)).toEqual(['program', 'build', 'data', 'design']);
    for (const w of WORKSTREAMS) nodeExpect(milestonesOf(w.id).length).toBeGreaterThan(0);
    // A step that names a milestone names one that exists.
    for (const w of WORKSTREAMS) {
      for (const step of w.flow) {
        if (typeof step.milestone === 'number') {
          nodeExpect(MILESTONES.some((m) => m.number === step.milestone)).toBe(true);
        }
      }
    }
  });

  nodeTest('the action tally adds up', () => {
    const tally = actionTally();
    const total = ACTION_GROUPS.reduce((n, g) => n + g.items.length, 0);
    nodeExpect(tally.done + tally.scheduled + tally.todo).toBe(total);
  });

  nodeTest('the wording follows the writing rules', () => {
    const text = JSON.stringify({
      PLAN,
      REVISIONS,
      VISION_GOALS,
      WORKSTREAMS,
      MILESTONES,
      TIMELINE_MARKERS,
      PHASES,
      MEETING_GROUPS,
      ACTION_GROUPS,
      STEWARDS,
    });
    // No en or em dashes, percent spelled out, and "and" in place of an ampersand or a plus.
    nodeExpect(text).not.toMatch(/[–—]/);
    nodeExpect(text).not.toMatch(/\d\s?%/);
    nodeExpect(text).not.toMatch(/ [&+] /);
    // Months with a date: Jan., Feb., Aug., Sept., Oct., Nov., and Dec. take a period; the rest are spelled out.
    nodeExpect(text).not.toMatch(/\b(Jan|Feb|Aug|Sept|Oct|Nov|Dec) \d/);
    nodeExpect(text).not.toMatch(/\b(Mar|Apr|Jun|Jul) \d/);
  });
});

test.describe('Redesign Plan page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/project-plan');
    await expect(page.getByRole('heading', { level: 1, name: PLAN.title })).toBeVisible();
  });

  test('opens with the dates, the contract, and the three headline facts', async ({ page }) => {
    await expect(page).toHaveTitle(/^Redesign Plan \| Monitoring Dashboard/);
    const meta = page.locator('.plan__meta');
    await expect(meta).toContainText('Nov. 12, 2026');
    await expect(meta).toContainText('Nov. 14, 2026');
    await expect(meta).toContainText('ESA Work Order 004, 27C00005, signed Oct. 22, 2026');
    const tiles = page.locator('.plan__tiles esa-stat');
    await expect(tiles).toHaveCount(3);
    await expect(tiles.nth(0)).toContainText('$20,000');
    await expect(tiles.nth(1)).toContainText('May 12, 2027');
    await expect(tiles.nth(1)).toContainText('Work order ends June 30, 2027');
    const tally = actionTally();
    const total = ACTION_GROUPS.reduce((n, g) => n + g.items.length, 0);
    await expect(tiles.nth(2)).toContainText(`${tally.done} of ${total}`);
  });

  test('has the ten sections, in order', async ({ page }) => {
    await expect(page.locator('.plan__h2')).toHaveText([
      'Proposed Revisions',
      'Status',
      'Vision',
      'Roles and Decision Rights',
      'Workstreams',
      'Workflow',
      'Timeline',
      'Meeting Cadence',
      'Action Items',
      'Data Stewardship',
    ]);
    await expect(page.locator('.revision')).toHaveCount(REVISIONS.length);
  });

  test('shows a status card and a workstream card for each of the four workstreams', async ({ page }) => {
    const names = WORKSTREAMS.map((w) => w.name);
    const status = page.locator('section[aria-labelledby="plan-status"] esa-card');
    await expect(status).toHaveCount(4);
    await expect(status.locator('.esa-card__title')).toHaveText(names);
    await expect(status.first().locator('esa-badge')).toHaveText('On Track');
    await expect(status.first().locator('time')).toHaveAttribute('datetime', '2026-11-12');

    const cards = page.locator('section[aria-labelledby="plan-workstreams"] esa-card');
    await expect(cards.locator('.esa-card__title')).toHaveText(names.map((name, i) => `${i + 1}. ${name}`));
    await expect(cards.nth(0)).toContainText('Milestone 3, Jan. 14: Master program list');
    await expect(cards.nth(1)).toContainText('Final Deliverable, May 12: Official launch');
  });

  test('draws the workflow as one lane per workstream, each step with its milestone', async ({ page }) => {
    const lanes = page.locator('.lane');
    await expect(lanes).toHaveCount(4);
    for (const w of WORKSTREAMS) {
      const lane = page.locator(`.lane[data-workstream="${w.id}"]`);
      await expect(lane.locator('.step')).toHaveCount(w.flow.length);
    }
    await expect(page.locator('.lane[data-workstream="program"] .step').last()).toContainText('Milestone 3, Jan. 14');
    await expect(page.locator('.lane[data-workstream="data"] .lane__feeds')).toContainText('Feeds Dashboard Build');
    await expect(page.locator('.lane[data-workstream="build"] .step').last()).toContainText('Final Deliverable, May 12');
  });

  test('draws every marker on the timeline, with a text alternative and a color key', async ({ page }) => {
    const timeline = page.locator('app-plan-timeline');
    await expect(timeline.locator('.tl__mark')).toHaveCount(TIMELINE_MARKERS.length);
    await expect(timeline.locator('.tl__name')).toHaveText(TIMELINE_MARKERS.map((m) => m.label));
    await expect(timeline.locator('svg desc')).toContainText('Jan. 14, 2027: Milestone 3, Master program list');
    await expect(timeline.locator('.tl__month').first()).toHaveText('Nov. 2026');
    await expect(timeline.locator('.tl-key__item')).toHaveCount(4);
    // Markers run left to right in date order, inside the drawing.
    const xs = await timeline.locator('.tl__dot').evaluateAll((dots) => dots.map((d) => Number(d.getAttribute('cx'))));
    expect(xs).toEqual([...xs].sort((a, b) => a - b));
    expect(Math.min(...xs)).toBeGreaterThan(60);
    expect(Math.max(...xs)).toBeLessThan(930);
  });

  test('lists the milestones, the meetings, and the action items in tables', async ({ page }) => {
    const milestones = page.locator('.ptable__table--milestones tbody tr');
    await expect(milestones).toHaveCount(MILESTONES.length);
    await expect(milestones.first()).toContainText('Milestone 1');
    await expect(milestones.first()).toContainText('Jan. 1, 2027');
    await expect(milestones.last()).toContainText('Final Deliverable');

    const meetings = page.locator('section[aria-labelledby="plan-meetings"]');
    await expect(meetings.locator('.ptable__group')).toHaveText(MEETING_GROUPS.map((g) => g.label));
    await expect(meetings.locator('tbody tr:not(.ptable__group)')).toHaveCount(
      MEETING_GROUPS.reduce((n, g) => n + g.meetings.length, 0),
    );

    const actions = page.locator('.ptable__table--actions');
    await expect(actions.locator('.ptable__group')).toHaveText(ACTION_GROUPS.map((g) => g.label));
    const tally = actionTally();
    await expect(actions.locator('tr[data-status="done"]')).toHaveCount(tally.done);
    await expect(actions.locator('tr[data-status="scheduled"]')).toHaveCount(tally.scheduled);
    await expect(actions.locator('tr[data-status="todo"]')).toHaveCount(tally.todo);
    await expect(actions.locator('tr[data-status="done"] esa-badge').first()).toHaveText('Done');
  });

  test('names a steward for each category, or says one is still to assign', async ({ page }) => {
    const stewards = page.locator('.steward');
    await expect(stewards).toHaveCount(STEWARDS.length);
    await expect(page.locator('.steward[data-assigned="false"]')).toHaveCount(
      STEWARDS.filter((s) => s.stewards.length === 0).length,
    );
    await expect(page.locator('.steward[data-assigned="false"]').first()).toContainText('Steward to assign');
  });

  test('uses no dashes or percent signs in its text', async ({ page }) => {
    const text = await page.locator('.plan').innerText();
    expect(text).not.toMatch(/[–—%]/);
  });

  test('About Monitoring links to the page', async ({ page }) => {
    await page.goto('/#about');
    await page.locator('app-about-monitoring').getByRole('link', { name: 'Redesign Plan' }).click();
    await expect(page).toHaveURL(/\/project-plan$/);
  });
});

test.describe('Redesign Plan page at 375 px wide', () => {
  test.use({ viewport: { width: 375, height: 800 } });

  test('does not scroll sideways; the timeline and tables scroll in their own boxes', async ({ page }) => {
    await page.goto('/project-plan');
    await expect(page.locator('.tl__mark').first()).toBeVisible();
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    expect(await page.locator('.tl').evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    expect(await page.locator('.ptable').last().evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
  });
});
