/*
 * project-plan.ts: the Monitoring Dashboard Redesign Plan, as data. Who owns what, the four
 * workstreams, the milestones, the meetings, the action items, and the data stewards.
 *
 * The Redesign Plan page (pages/project-plan) draws everything from here, so updating the plan
 * is editing this file: add a status entry to a workstream's log, change an action's status,
 * move a milestone's date. Specific dates are ISO (YYYY-MM-DD) and the page writes them in
 * TRPA style; a target that is not one date ("December", "This week") is written as it reads.
 *
 * Source: the working plan updated Nov. 12, 2026, with the revisions Mason proposed on
 * Nov. 14, 2026, for the team, Jeanne, and Dan to review. Pure data, no imports.
 */

export type WorkstreamId = 'program' | 'build' | 'data' | 'design';

export type Health = 'on-track' | 'in-progress' | 'at-risk';

export type ActionStatus = 'done' | 'scheduled' | 'todo';

export interface Fact {
  label: string;
  value: string;
}

export interface LogEntry {
  /** ISO date of the update. */
  date: string;
  text: string;
}

/** One step of a workstream, in the order the work happens. */
export interface FlowStep {
  text: string;
  /** When it happens, as it reads: "December", "After Jan. 14". */
  when?: string;
  /** The milestone this step delivers: its number, or 'final' for the launch. */
  milestone?: number | 'final';
  done?: boolean;
}

export interface Workstream {
  id: WorkstreamId;
  name: string;
  /** The data color that marks this workstream on the timeline, as a token. */
  color: string;
  health: Health;
  /** Status updates, newest first. */
  log: LogEntry[];
  next: string;
  /** Lead, team, and ESA contact. */
  facts: Fact[];
  /** What the workstream does, as a list. */
  work: string[];
  flow: FlowStep[];
  /** What the last step hands to another workstream. */
  feeds?: { to: WorkstreamId; what: string };
  flowNotes?: string[];
}

export interface Milestone {
  /** 1 to 6 for the numbered milestones; absent for the checkpoint and the launch. */
  number?: number;
  kind: 'milestone' | 'checkpoint' | 'final';
  /** A few words, for the workstream cards. */
  name: string;
  /** What is done when the milestone is met. */
  done: string;
  /** The workstream that delivers it, which sets its color on the timeline. */
  owner: WorkstreamId;
  /** The Workstream column of the milestones table. */
  workstreams: string;
  /** ISO date. */
  date: string;
}

export interface TimelineMarker {
  /** ISO date. */
  date: string;
  /** Two or three words, drawn on the timeline. */
  label: string;
  /** What the marker stands for, for the timeline's text alternative. */
  detail: string;
  owner: WorkstreamId | null;
}

export interface Phase {
  span: string;
  text: string;
}

export interface Meeting {
  name: string;
  who: string;
  cadence: string;
  /** A second line under the cadence. */
  cadenceNote?: string;
  purpose: string;
}

export interface ActionItem {
  action: string;
  owner: string;
  target: string;
  status: ActionStatus;
}

export interface Person {
  who?: string;
  text: string;
}

export interface PeopleGroup {
  title: string;
  lead?: string;
  points: Person[];
}

export const PLAN = {
  title: 'Monitoring Dashboard Redesign Plan',
  /** ISO dates. */
  updated: '2026-11-12',
  revised: '2026-11-14',
  signed: '2026-10-22',
  launch: '2027-05-12',
  workOrderEnd: '2027-06-30',
  /** The span the timeline axis covers. */
  timelineStart: '2026-11-01',
  timelineEnd: '2027-07-01',
  workOrder: 'ESA Work Order 004',
  contract: '27C00005',
  budget: '$20,000',
  budgetCovers: 'UX, design system, pull request review, and releases',
  vision:
    "A data-focused Monitoring Dashboard that is easy to navigate, shows current programs from TRPA and its partners, connects to the rest of LT Info, and is built and maintained by TRPA with ESA's support.",
  decisions:
    'Evelyn is project lead. Each lead decides within their area, and Amy provides technical oversight of the work. Jeanne is the TRPA project manager named on the work order and gives final review on everything. Disagreements go to Jeanne first, then to Dan if needed.',
  sources:
    'Sources: project notes and ESA Work Order 004 (contract 27C00005, Oct. 22, 2026). Revisions suggested by Mason on Nov. 14, 2026, for the team, Jeanne, and Dan to review.',
} as const;

/** The changes proposed to the Nov. 12 plan. They are already reflected in the rest of this file. */
export const REVISIONS: readonly { title: string; text: string }[] = [
  {
    title: 'Decision Rights',
    text: 'Each lead decides within their area. Evelyn is project lead on programs, data steward liaison, and the schedule. Andy leads the data model, data engineering, data viz, and analysis, and all data decisions. Amy leads web service architecture, web development, and technical oversight, reviewing the technical approach and quality of the work. Mason leads UX, web development, and ESA coordination. Thea signs off on brand and design standards. Jeanne gives final review on everything; disagreements go to Jeanne, then Dan.',
  },
  {
    title: 'Development Team and Dates',
    text: "Amy and Mason lead web development together. Milestones 2 and 6 are confirmed by Mason and Amy after the Shannon check-ins, since both depend on ESA's repo and review.",
  },
  {
    title: 'ESA Coordination',
    text: "Mason is TRPA's point person with ESA. Technical meetings are Mason and Amy. Commitments to ESA go through Mason or Jeanne.",
  },
  {
    title: 'Maintenance Plan',
    text: 'Mason and Amy maintain the dashboard code after launch. Andy leads maintenance of the data and data engineering.',
  },
  {
    title: 'Shared Updates',
    text: 'At the April leadership review, Evelyn presents programs and content, Mason presents UX improvements, Amy presents the build, and Andy presents the data engineering improvements and integrations. Workstream leads share the weekly Science and Data update.',
  },
  {
    title: 'Data Management',
    text: "Andy leads data management and debriefs the team as needed. Amy leads the web service architecture. The data acceptance criteria are drafted and live in Andy's data model page. Andy's team checks program owners' data against them, and Evelyn coordinates with the program owners.",
  },
  {
    title: 'Prototyping Sandbox',
    text: "Mason built a TRPA sandbox repo with Angular and Docker for fast UX prototyping with program leads and Evelyn. Patterns that work with users are then built in ESA's LT Info repo, so ESA reviews finished work, not experiments.",
  },
];

export const VISION_GOALS: readonly { title: string; text: string; points: string[] }[] = [
  {
    title: 'Better User Experience',
    text: 'More visual and data focused, with fewer pages and clicks.',
    points: [
      'Branding consistent with other LT Info dashboards, through a shared design system',
      'Dropdowns and sidebars to move between programs in a category',
      'Easy to view and download data',
    ],
  },
  {
    title: 'Current, Relevant Programs',
    text: 'Re-evaluate what the dashboard shows.',
    points: [
      'Archive programs that have ended or have no data',
      'Add new internal programs',
      'Add external programs from partners',
    ],
  },
  {
    title: 'Connected to Related Tools',
    text: 'Integrated with Tahoe Open Data, the Threshold Dashboard, and the Climate Resilience Dashboard.',
    points: ['Links to Tahoe Open Data and indicators'],
  },
  {
    title: 'TRPA Owns the Data',
    text: "Charts and maps pull directly from TRPA's REST services.",
    points: ['Updates appear in real time', 'ESA no longer needs to host the data'],
  },
  {
    title: 'TRPA Helps Own the Site',
    text: 'Closer collaboration with ESA on site updates.',
    points: ['TRPA developers submit pull requests to the LT Info GitHub repo'],
  },
];

export const PEOPLE: readonly PeopleGroup[] = [
  {
    title: 'Work Order Project Manager: Jeanne',
    points: [
      { text: 'Manages LT Info, the site that hosts the dashboard' },
      { text: 'Final review on all project decisions and deliverables' },
      { text: 'Signs off on ESA scope and budget' },
      { text: 'Runs bi-weekly LT Info meetings with ESA (Mason attends)' },
    ],
  },
  {
    title: 'Workstream Leads',
    lead: 'Each lead decides within their area.',
    points: [
      {
        who: 'Evelyn',
        text: 'project lead on programs, data steward liaison, and the schedule; schedules meetings, recruits program leads for the design loop, and weighs in on UX',
      },
      { who: 'Andy', text: 'data model, data engineering, data viz, and analysis; all data decisions' },
      {
        who: 'Amy',
        text: 'web service architecture, web development, and technical oversight of the work (reviews approach and quality)',
      },
      { who: 'Mason', text: 'leads UX through user-centered design; web development and ESA coordination' },
      { who: 'Thea', text: 'brand and design standards; signs off on the design system' },
    ],
  },
  {
    title: 'ESA Consultant: Liz and Julia',
    points: [
      {
        who: 'Shannon',
        text: 'technical: repo, pull request review, QA, and releases. TRPA point people: Mason and Amy',
      },
      { who: 'Mauricio', text: 'engineer for the design platform. TRPA point person: Thea' },
      { who: 'Ray', text: 'development environment setup, with Amy' },
      { text: 'Commitments to ESA on scope, dates, or budget go through Mason or Jeanne' },
    ],
  },
];

/** The four workstreams, in the order the plan numbers them. */
export const WORKSTREAMS: readonly Workstream[] = [
  {
    id: 'program',
    name: 'Program Management',
    color: 'var(--color-background-dataviz-categorical-2)',
    health: 'on-track',
    log: [
      {
        date: '2026-11-12',
        text: 'Meeting with internal category owners to inventory current programs and what we might want to add or remove. Category and program inventory due Nov. 18.',
      },
    ],
    next: "Review the inventory with Andy and Mason. In December, Evelyn sets program acceptance criteria, linked to the data acceptance criteria in Andy's data model page. Milestone 3 (master program list): Jan. 14.",
    facts: [
      { label: 'Lead', value: 'Evelyn' },
      { label: 'Team', value: 'Andy, Mason; internal and external data stewards' },
      { label: 'ESA', value: 'None (internal)' },
    ],
    work: [
      'Work with internal category and monitoring program owners on what the dashboard shows, through launch and after',
      'Decide which programs to add, remove, or bring in from partners',
      "Set program acceptance criteria, linked to Andy's data acceptance criteria",
      'Keep program owners involved as their programs move onto the dashboard',
    ],
    flow: [
      { text: 'Evelyn meets category owners', when: 'Inventory due Nov. 18' },
      { text: 'Evelyn, Andy, and Mason review against criteria', when: 'December' },
      { text: 'Evelyn and Andy pitch to stewards', when: 'Early January' },
      { text: 'Master program list', milestone: 3 },
    ],
    feeds: { to: 'data', what: 'the master program list; owners are told what is displayed' },
    flowNotes: ['Ongoing: Evelyn works with program owners throughout the project and after launch.'],
  },
  {
    id: 'build',
    name: 'Dashboard Build',
    color: 'var(--color-background-dataviz-categorical-1)',
    health: 'in-progress',
    log: [
      { date: '2026-11-13', text: 'Mason and Shannon met and got the development environment set up.' },
      {
        date: '2026-11-12',
        text: "Mason has Docker, SQL Server, and the Angular components running in a container. Reading the codebase with AI used a lot of tokens, so getting started with Shannon's guidance may be more efficient. Mason meets Shannon on Friday.",
      },
    ],
    next: 'Amy sets up a parallel development environment. Weekly standups with Shannon start the week of Nov. 16. Milestone 2 (LT Info framework): Jan. 4.',
    facts: [
      {
        label: 'Leads',
        value: 'Amy (web development, technical oversight) and Mason (web development, UX, ESA coordination)',
      },
      {
        label: 'UX',
        value:
          "User-centered design loop led by Mason with monitoring program leads and Evelyn's input; Thea reviews and signs off. Evelyn recruits program leads and schedules sessions",
      },
      { label: 'ESA', value: 'Shannon' },
    ],
    work: [
      'Repo access, Docker, SQL Server, and Angular components (Mason and Amy)',
      'Mason and Amy build program pages and templates to LT Info conventions, with no one-off pages',
      'Home page, navigation, dropdowns, and sidebars',
      "UX prototyping and user testing with program leads in the TRPA sandbox repo, then built in ESA's LT Info repo",
      'Mason and Amy submit pull requests into develop; never commit to main',
      'Mason and Amy maintain the dashboard code after launch',
      'Development milestone dates (2 and 6) confirmed by Mason and Amy after Shannon check-ins',
    ],
    flow: [
      { text: 'Amy and Mason: development setup and repo' },
      { text: 'Docker, SQL Server, and Angular', done: true },
      { text: 'Mason and Amy build pages', milestone: 2 },
      { text: 'Amy reviews the pull request into develop' },
      { text: 'ESA merges and releases to QA' },
      { text: 'Cutover to production (ESA)', milestone: 'final' },
    ],
    flowNotes: [
      'Sandbox prototypes with program leads run alongside page building, in both directions (Milestone 5, March 25).',
      'Changes requested in ESA review go back to page building.',
      'The preliminary dashboard is Milestone 6, April 1.',
    ],
  },
  {
    id: 'data',
    name: 'Data Management',
    color: 'var(--color-background-dataviz-categorical-6)',
    health: 'in-progress',
    log: [
      {
        date: '2026-11-14',
        text: 'Andy has the data model page and data acceptance criteria in place. Andy leads data management and debriefs the team as needed. Amy leads the web service architecture.',
      },
    ],
    next: 'Andy walks the team through his data model page. Milestone 4 (data ready in SQL): March 1.',
    facts: [
      { label: 'Lead', value: 'Andy (data model, data engineering, data viz, and analysis; all data decisions)' },
      { label: 'Team', value: 'Mason (as needed), Amy (data engineering and technical oversight)' },
      { label: 'ESA', value: 'None (internal)' },
      {
        label: 'Before engineering',
        value:
          "Data acceptance criteria are set and live in Andy's data model page. Andy checks program owners' data against them; Evelyn coordinates with the program owners",
      },
    ],
    work: [
      'Data model page and data acceptance criteria (done, Andy)',
      'SQL schema and data model',
      'How data is stored in SQL, including whether it is stacked, and how the views work',
      'How the data feeds into LT Info',
      'Move spreadsheets and feature classes to normalized tables with views',
      'Raw data to threshold attainment calls; threshold evaluation',
      'Validation and live QA on incoming data',
      'Clean up the LT Info Monitoring service (with Amy)',
      'Demographics as a self-service page, and retire the Tahoe Open Data demographics page (with Amy)',
      "Web service architecture: how TRPA's services feed the dashboard, LT Info, and Tahoe Open Data (Amy leads)",
      'Andy leads year-round maintenance of the data and data engineering after launch',
      'Andy debriefs the team as needed',
    ],
    flow: [
      { text: 'Program criteria set; data criteria done', when: 'December' },
      { text: 'Andy gets data from program owners', when: 'After Jan. 14' },
      { text: 'Andy checks data against criteria', when: 'Jan. 14 to March 1' },
      { text: 'Andy: SQL and views. Amy: web services', milestone: 4 },
    ],
    feeds: { to: 'build', what: 'data and web services' },
  },
  {
    id: 'design',
    name: 'Design System',
    color: 'var(--color-background-dataviz-categorical-4)',
    health: 'in-progress',
    log: [
      {
        date: '2026-11-14',
        text: "Mason built a TRPA sandbox repo (Angular and Docker) for fast UX prototyping with program leads. Patterns that work are then built in ESA's LT Info repo.",
      },
      {
        date: '2026-11-12',
        text: 'An example page built on the Ecology design standards is ready. Thea will add agency branding. Thea and Mauricio kick off Monday, Nov. 16.',
      },
    ],
    next: "Mason leads the user-centered design loop on the example page with program leads and Evelyn's input; Thea reviews and signs off. Amy and Mason use the prototype as the sample to build from. Milestone 1 (design standards): Jan. 1.",
    facts: [
      { label: 'Lead', value: 'Thea' },
      { label: 'Team', value: 'Jeanne (final review), Amy, Mason, Evelyn' },
      { label: 'ESA', value: 'Mauricio, through Thea' },
    ],
    work: [
      'An example page built on the Ecology design standards is ready for agency branding',
      "Mason built a TRPA sandbox repo (Angular and Docker) for fast prototyping with program leads; patterns that work are built in ESA's LT Info repo",
      'Thea adds agency branding, after meeting with Mauricio',
      'Jeanne gives final approval before the standards become a Claude skill',
      "After the standards are done, Mason leads a user-centered design loop with program leads and Evelyn's input; Thea reviews and signs off",
      'Mauricio gives feedback once or twice before launch',
    ],
    flow: [
      { text: 'Ecology design standards' },
      { text: 'Example page', done: true },
      { text: 'Thea adds agency branding' },
      { text: 'Jeanne gives final approval' },
      { text: 'Standards become a Claude skill', milestone: 1 },
      { text: 'Mason and program leads iterate on UX design', when: 'Mauricio gives feedback once or twice' },
    ],
    feeds: { to: 'build', what: 'UX design' },
  },
];

/** Milestones in date order; the numbers follow the dates. */
export const MILESTONES: readonly Milestone[] = [
  {
    number: 1,
    kind: 'milestone',
    name: 'Design standards',
    done: 'Design standards: Thea adds agency branding to the example page; Jeanne approves',
    owner: 'design',
    workstreams: 'Design system',
    date: '2027-01-01',
  },
  {
    number: 2,
    kind: 'milestone',
    name: 'In the LT Info framework',
    done: 'Dashboard integrated into the LT Info framework. Date confirmed by Mason and Amy after Shannon check-ins',
    owner: 'build',
    workstreams: 'Dashboard build',
    date: '2027-01-04',
  },
  {
    number: 3,
    kind: 'milestone',
    name: 'Master program list',
    done: 'Master list of programs we want to include',
    owner: 'program',
    workstreams: 'Program management',
    date: '2027-01-14',
  },
  {
    number: 4,
    kind: 'milestone',
    name: 'Data checked and in SQL',
    done: 'Data checked against the data acceptance criteria and built into SQL, led by Andy',
    owner: 'data',
    workstreams: 'Data management',
    date: '2027-03-01',
  },
  {
    number: 5,
    kind: 'milestone',
    name: 'Pages reviewed with owners',
    done: 'Program pages reviewed with monitoring program owners',
    owner: 'build',
    workstreams: 'Dashboard build, program management',
    date: '2027-03-25',
  },
  {
    number: 6,
    kind: 'milestone',
    name: 'Preliminary dashboard',
    done: 'Preliminary dashboard built; review and stress test through April 20. Date confirmed by Mason and Amy after Shannon check-ins',
    owner: 'build',
    workstreams: 'All',
    date: '2027-04-01',
  },
  {
    kind: 'checkpoint',
    name: 'Secondary dashboard',
    done: 'Secondary dashboard; team and ESA comments through May 12',
    owner: 'build',
    workstreams: 'All',
    date: '2027-04-20',
  },
  {
    kind: 'final',
    name: 'Official launch',
    done: 'Official launch of the finalized dashboard',
    owner: 'build',
    workstreams: 'All',
    date: '2027-05-12',
  },
];

/** What a milestone is called in a table or on the timeline: "Milestone 3", "Checkpoint", "Final Deliverable". */
export const milestoneLabel = (m: Milestone): string =>
  m.kind === 'milestone' ? `Milestone ${m.number}` : m.kind === 'checkpoint' ? 'Checkpoint' : 'Final Deliverable';

/** Everything drawn on the timeline, in date order: the inventory, the milestones, and the work order's end. */
export const TIMELINE_MARKERS: readonly TimelineMarker[] = [
  {
    date: '2026-11-18',
    label: 'Inventory due',
    detail: 'Category and program inventory due',
    owner: 'program',
  },
  ...MILESTONES.map(
    (m): TimelineMarker => ({
      date: m.date,
      label: m.kind === 'final' ? 'Launch' : milestoneLabel(m),
      detail: m.name,
      owner: m.owner,
    }),
  ),
  { date: PLAN.workOrderEnd, label: 'Work order ends', detail: 'ESA Work Order 004 ends', owner: null },
];

export const PHASES: readonly Phase[] = [
  {
    span: 'Now through December',
    text: "Gather the category and program inventory (due Nov. 18) and develop the program acceptance criteria. The data acceptance criteria are already in Andy's data model page.",
  },
  {
    span: 'January to April 1',
    text: "Create the master program list using the acceptance criteria (Jan. 14) and let program owners know what will be displayed. Then Andy leads getting the data from program owners and the data engineering, while Evelyn coordinates with program owners, and Mason reviews each program page with its owner. After the design standards are done, Mason leads a user-centered design loop with program leads and Evelyn's input, and Thea reviews and signs off. Mason and Amy build throughout.",
  },
  {
    span: 'April 1 to 20',
    text: 'Dan, Beth, Jeanne, Thea, and others review the preliminary dashboard, comment, and stress test it.',
  },
  {
    span: 'April 20 to May 12',
    text: 'Our team comments on the secondary dashboard; Mauricio and ESA may weigh in. Communications with Thea for the launch.',
  },
  {
    span: 'May 12 to June 30',
    text: 'About seven weeks to tweak and make sure everything works before the work order ends.',
  },
  {
    span: 'Ongoing',
    text: 'Evelyn works with monitoring program owners throughout, and after launch.',
  },
];

export const MEETING_GROUPS: readonly { label: string; meetings: Meeting[] }[] = [
  {
    label: 'Happening Now',
    meetings: [
      {
        name: 'Data team meeting',
        who: 'Evelyn, Andy, Mason, Amy; Beth optional',
        cadence: 'Weekly, Thursday mornings',
        purpose:
          'Status across all workstreams, steward follow-ups, build and data tasks, and open pull requests. Mason and Amy relay updates from the Shannon standups, Evelyn updates on programs, and Andy updates on data work.',
      },
      {
        name: 'ESA development standup',
        who: 'Mason and Amy with Shannon; Ray for environment setup',
        cadence: 'Weekly standup, starting the week of Nov. 16',
        cadenceNote: 'Setup meeting held Nov. 13',
        purpose:
          'Pull requests, QA releases, and blockers. Mason and Amy relay updates to the data team. Day-to-day coordination by email or Teams; not tracked in Jira.',
      },
      {
        name: 'Program owner meetings',
        who: 'Evelyn with internal category and monitoring program owners',
        cadence: 'Ongoing, through launch and after',
        purpose:
          'Brainstorm programs to add, remove, or bring in from partners, and keep owners involved as their programs move onto the dashboard.',
      },
      {
        name: 'Design system',
        who: "Thea and Mauricio first; then a user-centered design loop led by Mason with program leads and Evelyn's input, with Thea's review and sign-off",
        cadence: 'Kickoff Monday, Nov. 16, then as needed',
        cadenceNote: 'Mauricio gives feedback once or twice before launch',
        purpose:
          'Thea adds agency branding to the example page. Jeanne gives final approval before the standards become a Claude skill.',
      },
      {
        name: 'Data model working session',
        who: 'Andy (lead); Mason and Amy as needed',
        cadence: 'Starts with a data model meeting, then as needed',
        purpose:
          'Data model and SQL schema, whether data is stacked, how the views work and feed LT Info, raw data to threshold calls, validation, and cleaning up the LT Info Monitoring service.',
      },
      {
        name: 'Science and Data team meeting',
        who: 'Workstream leads give a short update to the wider team',
        cadence: 'Weekly, short update',
        purpose:
          'Progress against milestones, upcoming steward requests, and decisions the wider team should know about.',
      },
      {
        name: 'LT Info bi-weekly (Jeanne and ESA)',
        who: 'Mason attends and gives the update; Amy joins for technical topics',
        cadence: 'Every two weeks',
        purpose: 'Status against milestones, decisions needed from ESA, and anything that affects scope or budget.',
      },
    ],
  },
  {
    label: 'Coming Up',
    meetings: [
      {
        name: 'Data steward pitch meetings',
        who: 'Evelyn and Andy with data stewards',
        cadence: 'Early January, before the master list on Jan. 14',
        purpose: 'Share what works and what does not against the program and data acceptance criteria.',
      },
      {
        name: 'Program page reviews',
        who: 'Mason with each monitoring program owner, prototyping in the TRPA sandbox; Evelyn coordinates',
        cadence: "Once a program's data is organized, by March 25",
        purpose:
          'Work out how each program comes across on the dashboard (Milestone 5). ESA reviews once or twice before launch.',
      },
      {
        name: 'Leadership review',
        who: 'Dan, Beth, Jeanne, Thea, and others; Evelyn presents programs and content, Mason presents UX improvements, Amy presents the build, and Andy presents data engineering improvements and integrations',
        cadence: 'April 1 to 20, after the preliminary dashboard',
        purpose: 'Review, comment on, and stress test the preliminary dashboard on the protected test site.',
      },
      {
        name: 'Secondary dashboard review',
        who: 'Data team; Mauricio and ESA may weigh in',
        cadence: 'April 20 to May 12',
        purpose: 'Final comments before the May 12 launch.',
      },
      {
        name: 'Program owner check-ins after launch',
        who: 'Evelyn with monitoring program owners and data stewards',
        cadence: 'Quarterly after launch',
        purpose: 'Keep programs and data current, add new programs, and archive ended ones.',
      },
    ],
  },
];

export const ACTION_GROUPS: readonly { label: string; items: ActionItem[] }[] = [
  {
    label: 'This Week (by Nov. 13)',
    items: [
      {
        action: 'Build an example page from the Ecology design standards',
        owner: 'Mason',
        target: 'Nov. 12',
        status: 'done',
      },
      {
        action: 'Brief Evelyn on what has been communicated so far with Shannon, Mauricio, and Thea',
        owner: 'Mason',
        target: 'This week',
        status: 'todo',
      },
      {
        action: "Meet Shannon to get the build started with ESA's guidance; development environment set up",
        owner: 'Mason',
        target: 'Friday, Nov. 13',
        status: 'done',
      },
      {
        action:
          'Email ESA the point people: Mason and Amy with Shannon for technical work; Thea with Mauricio for design; commitments to ESA through Mason or Jeanne. Mason attends the LT Info bi-weekly',
        owner: 'Mason',
        target: 'This week',
        status: 'todo',
      },
      {
        action: 'Send recurring invites for the internal meetings above',
        owner: 'Evelyn',
        target: 'Nov. 13',
        status: 'todo',
      },
    ],
  },
  {
    label: 'Next Week (Nov. 16 to 20)',
    items: [
      { action: 'Design system kickoff', owner: 'Thea, Mauricio', target: 'Monday, Nov. 16', status: 'scheduled' },
      {
        action:
          'Confirm the Jan. 1 design standards target (Milestone 1) at the kickoff, and have Thea add agency branding to the example page',
        owner: 'Thea',
        target: 'Monday, Nov. 16',
        status: 'todo',
      },
      {
        action: 'Data steward meetings on current programs',
        owner: 'Evelyn',
        target: 'Inventory due Nov. 18',
        status: 'scheduled',
      },
      {
        action: 'Andy walks the team through his data model page',
        owner: 'Andy',
        target: 'Next week',
        status: 'todo',
      },
      {
        action:
          'Iterate on the example page with Thea as she adds agency branding; ask whether a service can be built into the monitoring framework, so there are no one-off pages',
        owner: 'Mason, program leads, Thea',
        target: 'After the kickoff',
        status: 'todo',
      },
      {
        action:
          'Amy sets up a parallel development environment (Docker, SQL Server, Angular) with Ray; written OK from TRPA IT on keeping a local production database copy',
        owner: 'Amy, with Ray (ESA)',
        target: 'Nov. 25',
        status: 'todo',
      },
      {
        action: 'Set up a weekly standup with Shannon',
        owner: 'Mason, Amy',
        target: 'Starts week of Nov. 16',
        status: 'scheduled',
      },
      {
        action:
          'One-page development workflow note: coordination channel, branch naming, pull request checklist, and where tasks and testing are tracked without Jira',
        owner: 'Amy, Mason',
        target: 'Nov. 20',
        status: 'todo',
      },
    ],
  },
  {
    label: 'By End of November',
    items: [
      {
        action: 'Set dates for Milestone 3 (master list, Jan. 14) and Milestone 5 (page reviews, March 25)',
        owner: 'Evelyn',
        target: 'Nov. 12',
        status: 'done',
      },
      {
        action:
          'Inventory of the LT Info Monitoring service: every layer and API endpoint, with keep, move, or retire for each',
        owner: 'Amy, with Andy',
        target: 'Dec. 4',
        status: 'todo',
      },
      {
        action:
          'Technical review checklist for every TRPA pull request: LT Info conventions, OWASP security basics, accessibility, and no one-off pages',
        owner: 'Amy',
        target: 'Nov. 30',
        status: 'todo',
      },
    ],
  },
  {
    label: 'December to March',
    items: [
      {
        action: 'Schedule meetings with Mauricio for feedback on the design (once or twice before launch)',
        owner: 'Thea',
        target: 'January',
        status: 'todo',
      },
      {
        action: 'Formalize conversations with external data stewards: Cara Moore, Emily (Andy started), and Transit',
        owner: 'Evelyn, Andy',
        target: 'December',
        status: 'todo',
      },
      {
        action: 'Set up data stewards for each EIP working group and monitoring category, coordinating with Kat',
        owner: 'Mason, Beth',
        target: 'December',
        status: 'todo',
      },
      {
        action: 'Set program acceptance criteria: type of program, whether it fits the dashboard, and who manages it',
        owner: 'Evelyn (Andy and Mason help)',
        target: 'December',
        status: 'todo',
      },
      {
        action:
          "Set data acceptance criteria: how data is stored and structured, completeness, partner access, validation, and live QA. No embedded dashboards from other sites. Lives in Andy's data model page",
        owner: 'Andy',
        target: 'Done',
        status: 'done',
      },
      {
        action: 'Review the brainstormed program list against the acceptance criteria and decide what makes sense',
        owner: 'Evelyn, Andy, Mason',
        target: 'December',
        status: 'todo',
      },
      {
        action: 'Pitch to data stewards what works and what does not',
        owner: 'Evelyn, Andy',
        target: 'Early January',
        status: 'todo',
      },
      {
        action: 'Finalize the master program list using the acceptance criteria (Milestone 3)',
        owner: 'Evelyn, Andy, Mason',
        target: 'Jan. 14',
        status: 'todo',
      },
      {
        action: 'Let program owners know whether their program will be displayed on the dashboard',
        owner: 'Evelyn',
        target: 'After Jan. 14',
        status: 'todo',
      },
      {
        action:
          "Check program owners' data against the data acceptance criteria (Milestone 4). Evelyn coordinates with program owners",
        owner: 'Andy',
        target: 'By March 1',
        status: 'todo',
      },
      {
        action:
          'Design the SQL schema: how data is stored (stacked or not), the views, and how it feeds LT Info. Move spreadsheets and feature classes to normalized tables (Milestone 4)',
        owner: 'Andy, Amy',
        target: 'By March 1',
        status: 'todo',
      },
      {
        action:
          'Web service architecture document: diagram, endpoint list, naming and versioning rules, and how services feed the dashboard, LT Info, and Tahoe Open Data. Reviewed by Andy and Mason',
        owner: 'Amy',
        target: 'Dec. 18',
        status: 'todo',
      },
      {
        action: 'First program page template merged to develop and running on monitoring-new, ahead of Milestone 2',
        owner: 'Amy, Mason',
        target: 'Dec. 4',
        status: 'todo',
      },
      {
        action:
          'Cleaned-up LT Info Monitoring service holding only data that lives outside TRPA (such as Transportation and RSWAMP), with a changelog of layers moved or retired',
        owner: 'Amy, with Andy',
        target: 'Jan. 29',
        status: 'todo',
      },
      {
        action: 'Plan a Transportation-focused monitoring meeting (depends on ESA). The Transportation Tracker is paused',
        owner: 'Mason, Kira',
        target: 'January',
        status: 'todo',
      },
      {
        action:
          "Review program pages with monitoring program owners in the TRPA sandbox, once each program's data is organized (Milestone 5). Evelyn coordinates",
        owner: 'Mason, Evelyn',
        target: 'By March 25',
        status: 'todo',
      },
      {
        action: 'Schedule a design review of the example pages with Mauricio',
        owner: 'Thea, Mason',
        target: 'Date to set',
        status: 'todo',
      },
      {
        action:
          'Repackage demographics as a self-service page; bring the Tahoe Open Data demographics page into the dashboard',
        owner: 'Andy, Amy',
        target: 'By March 1',
        status: 'todo',
      },
      {
        action:
          'Automated validation checks on incoming data (service down, null values, wrong year), with alerts to the data team',
        owner: 'Amy, Andy',
        target: 'March 1',
        status: 'todo',
      },
      {
        action:
          'Book the April 1 to 20 review and stress test with Dan, Beth, Jeanne, Thea, and others, so it is on their calendars early',
        owner: 'Evelyn',
        target: 'By December',
        status: 'todo',
      },
    ],
  },
  {
    label: 'April to May',
    items: [
      {
        action:
          'Written cutover and release plan from ESA for May 12, with the last pull requests merged a week or two ahead',
        owner: 'Mason, Amy',
        target: 'March 15',
        status: 'todo',
      },
      { action: 'Build demo for the April leadership review', owner: 'Amy', target: 'April 1', status: 'todo' },
      {
        action:
          'Collect team comments on the secondary dashboard (Evelyn); ask Mauricio and ESA for input (Mason)',
        owner: 'Evelyn, Mason',
        target: 'April 20 to May 12',
        status: 'todo',
      },
      {
        action: 'Plan launch communications with Thea',
        owner: 'Evelyn, Thea',
        target: 'April 20 to May 12',
        status: 'todo',
      },
      {
        action: 'Maintenance runbook for the dashboard code: release steps, ESA contacts, and common fixes',
        owner: 'Amy, Mason',
        target: 'May 12',
        status: 'todo',
      },
    ],
  },
  {
    label: 'Ongoing',
    items: [
      {
        action: 'Technical review of every TRPA pull request before it goes to ESA, using the review checklist',
        owner: 'Amy, Mason',
        target: 'Ongoing',
        status: 'todo',
      },
      {
        action:
          "Track ESA hours against the $20,000 work order budget. Keep ESA meetings short and use Shannon's guidance instead of having AI read the whole codebase",
        owner: 'Mason, with Jeanne',
        target: 'Ongoing',
        status: 'todo',
      },
    ],
  },
  {
    label: 'ESA Setup',
    items: [
      {
        action: 'Set up the protected subdomain (monitoring-new.laketahoeinfo.org); needs DNS changes',
        owner: 'Shannon (ESA)',
        target: 'Nov. 13',
        status: 'done',
      },
      {
        action: 'Get TRPA access to the ltinfo GitHub repo and a copy of the production database',
        owner: 'Shannon (ESA)',
        target: 'Nov. 13',
        status: 'done',
      },
    ],
  },
];

/** Monitoring categories and their data stewards. An empty list is a steward still to assign. */
export const STEWARDS: readonly { category: string; stewards: string[] }[] = [
  { category: 'Air Quality', stewards: ['Beth', 'Evelyn'] },
  { category: 'Aquatic Invasive Species', stewards: ['Emily', 'Andy'] },
  { category: 'Biodiversity', stewards: [] },
  { category: 'Climate and Lake Conditions', stewards: [] },
  { category: 'Fire Dynamics', stewards: ['Mason'] },
  { category: 'Fisheries', stewards: ['Andy', 'Beth'] },
  { category: 'Forest Structure', stewards: ['Mason'] },
  { category: 'Housing and Economy', stewards: [] },
  { category: 'Noise', stewards: ['Andy', 'Beth'] },
  { category: 'Recreation', stewards: ['Devin', 'Amy'] },
  { category: 'Scenic', stewards: ['Andy', 'Jeanne'] },
  { category: 'Soils', stewards: ['Beth', 'Evelyn', 'Mason', 'Andy'] },
  { category: 'Transportation', stewards: ['Rachael', 'Josh', 'Kira', 'Rory'] },
  { category: 'Uncommon and Sensitive Plants', stewards: ['Beth'] },
  { category: 'Water Quality', stewards: ['Evelyn', 'Dan'] },
  { category: 'Wildlife', stewards: ['Beth'] },
  { category: 'Demographics', stewards: ['Andy'] },
  { category: 'Other (no category fits)', stewards: ['Mason', 'Evelyn'] },
];

export const workstreamById = (id: WorkstreamId): Workstream => {
  const found = WORKSTREAMS.find((w) => w.id === id);
  if (!found) throw new Error(`No workstream with the ID ${id}`);
  return found;
};

/** The milestones a workstream delivers, in date order. */
export const milestonesOf = (id: WorkstreamId): Milestone[] => MILESTONES.filter((m) => m.owner === id);

/** How many action items have each status. */
export const actionTally = (): Record<ActionStatus, number> => {
  const tally: Record<ActionStatus, number> = { done: 0, scheduled: 0, todo: 0 };
  for (const group of ACTION_GROUPS) for (const item of group.items) tally[item.status] += 1;
  return tally;
};
