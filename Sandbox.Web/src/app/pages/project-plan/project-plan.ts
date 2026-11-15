import { ChangeDetectionStrategy, Component } from '@angular/core';

import { EsaBadge, EsaBadgeVariant } from '../../ecology/esa-badge';
import { EsaCard } from '../../ecology/esa-card';
import { EsaStat } from '../../ecology/esa-stat';
import { trpaDate } from '../../lib/plan-dates';
import {
  ACTION_GROUPS,
  ActionStatus,
  DECISIONS,
  FlowStep,
  Health,
  LINKS,
  MEETING_GROUPS,
  MILESTONES,
  Milestone,
  PEOPLE,
  PHASES,
  PLAN,
  STEWARDS,
  StewardGroup,
  VISION_GOALS,
  WORKSTREAMS,
  WorkstreamId,
  actionTally,
  milestoneLabel,
  milestonesOf,
  stewardLine,
  workstreamById,
} from '../../lib/project-plan';
import { Breadcrumb, Crumb } from '../../shared/breadcrumb';
import { PlanTimeline } from './plan-timeline';

const HEALTH_LABEL: Record<Health, string> = {
  'on-track': 'On Track',
  'in-progress': 'In Progress',
  'at-risk': 'At Risk',
};

const HEALTH_VARIANT: Record<Health, EsaBadgeVariant> = {
  'on-track': 'success',
  'in-progress': 'info',
  'at-risk': 'warning',
};

const STATUS_LABEL: Record<ActionStatus, string> = {
  done: 'Done',
  scheduled: 'Scheduled',
  drafted: 'Drafted',
  todo: 'To Do',
};

const STATUS_VARIANT: Record<ActionStatus, EsaBadgeVariant> = {
  done: 'success',
  scheduled: 'info',
  drafted: 'info',
  todo: 'neutral',
};

/**
 * The Redesign Plan page: the key decisions, who owns what, the four workstreams and how they feed each other,
 * the timeline and milestones, the meetings, the action items, and the data stewards. Every
 * word and date comes from lib/project-plan.ts; this file only says how to show them.
 */
@Component({
  selector: 'app-project-plan',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [Breadcrumb, EsaBadge, EsaCard, EsaStat, PlanTimeline],
  templateUrl: './project-plan.html',
  styleUrl: './project-plan.scss',
})
export class ProjectPlan {
  /** The page is reached from About Monitoring on the home page. */
  protected readonly trail: readonly Crumb[] = [
    { label: 'Monitoring Programs', link: ['/'] },
    { label: 'About Monitoring', link: ['/'], fragment: 'about' },
    { label: 'Redesign Plan' },
  ];

  protected readonly plan = PLAN;
  protected readonly links = LINKS;
  protected readonly decisions = DECISIONS;
  protected readonly goals = VISION_GOALS;
  protected readonly people = PEOPLE;
  protected readonly workstreams = WORKSTREAMS;
  protected readonly milestones = MILESTONES;
  protected readonly phases = PHASES;
  protected readonly meetingGroups = MEETING_GROUPS;
  protected readonly actionGroups = ACTION_GROUPS;
  protected readonly stewards = STEWARDS;
  protected readonly tally = actionTally();
  protected readonly actionTotal = ACTION_GROUPS.reduce((n, group) => n + group.items.length, 0);

  protected readonly healthLabel = HEALTH_LABEL;
  protected readonly healthVariant = HEALTH_VARIANT;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly statusVariant = STATUS_VARIANT;

  /** "Jan. 14", or "Jan. 14, 2027" with the year. */
  protected date(iso: string, year = false): string {
    return trpaDate(iso, { year });
  }

  protected milestoneLabel(m: Milestone): string {
    return milestoneLabel(m);
  }

  /** "Milestone 3, Jan. 14: Master program list" for each milestone a workstream delivers. */
  protected milestoneLines(id: WorkstreamId): string[] {
    return milestonesOf(id).map((m) => `${milestoneLabel(m)}, ${trpaDate(m.date)}: ${m.name}`);
  }

  /** The note under a workflow step: its milestone and date, that it is done, or when it happens. */
  protected stepNote(step: FlowStep): string {
    if (step.milestone !== undefined) {
      const m = MILESTONES.find((x) => (step.milestone === 'final' ? x.kind === 'final' : x.number === step.milestone));
      return m ? `${milestoneLabel(m)}, ${trpaDate(m.date)}` : '';
    }
    if (step.done) return 'Done';
    return step.when ?? '';
  }

  /** "TRPA (Emily, Andy), TRCD (Sarah M.)" for a category's stewards. */
  protected stewardLine(groups: readonly StewardGroup[]): string {
    return stewardLine(groups);
  }

  protected workstreamName(id: WorkstreamId): string {
    return workstreamById(id).name;
  }

  /** The workstream's data color, as the token the timeline uses. */
  protected color(id: WorkstreamId): string {
    return workstreamById(id).color;
  }
}
