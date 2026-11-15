/*
 * project-plan.ts: the Monitoring Dashboard Redesign Plan, as data. The key decisions, who owns
 * what, the four workstreams, the milestones, the meetings, the action items, and the data
 * stewards.
 *
 * The Redesign Plan page (pages/project-plan) draws everything from here, so updating the plan
 * is editing this file: add a status entry to a workstream's log, change an action's status,
 * move a milestone's date. Specific dates are ISO (YYYY-MM-DD) and the page writes them in
 * TRPA style; a target that is not one date ("December", "By March 1") is written as it reads.
 *
 * Source: the working plan updated Nov. 16, 2026. Pure data, no imports.
 */

export type WorkstreamId = 'program' | 'build' | 'data' | 'design';

export type Health = 'on-track' | 'in-progress' | 'at-risk';

export type ActionStatus = 'done' | 'scheduled' | 'drafted' | 'todo';

export interface Fact {
  label: string;
  value: string;
}

/** A link in the page header. */
export interface PlanLink {
  label: string;
  href: string;
  /** What the link leads to, when its label does not say. */
  note?: string;
}

/** One of the decisions the rest of the plan follows from. */
export interface Decision {
  title: string;
  text?: string;
  points?: string[];
  /** A closing line under the points. */
  note?: string;
}

export interface LogEntry {
  /** ISO date of the update. */
  date: string;
  text: string;
}

/** One step of a workstream, in the order the work happens. */
export interface FlowStep {
  text: string;
  /** When it happens, as it reads: "December", "From Jan. 14". */
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

/** The stewards one organization provides for a category. */
export interface StewardGroup {
  org: string;
  people: string[];
}

export const PLAN = {
  title: 'Monitoring Dashboard Redesign Plan',
  /** ISO dates. */
  updated: '2026-11-16',
  signed: '2026-10-22',
  preliminary: '2027-04-01',
  secondary: '2027-04-20',
  launch: '2027-05-12',
  workOrderEnd: '2027-06-30',
  /** The span the timeline axis covers. */
  timelineStart: '2026-11-01',
  timelineEnd: '2027-07-01',
  workOrder: 'ESA Work Order 004',
  contract: '27C00005',
  budget: '$20,000',
  budgetCovers: 'UX, design system, pull request review, and releases',
  summary:
    "Who's doing what, how the pieces connect, and when we meet. Each lead makes the calls in their area, and Jeanne gives final review on milestones and ESA scope and budget. ESA handles design, code review, and releases under Work Order 004.",
  decisionsIntro:
    "How the work is divided and who decides what. Leads make the calls in their areas, but we all learn from each other, so share feedback openly and give each other's feedback real weight. The rest of the page follows from these.",
  statusIntro: 'Latest updates for each workstream, newest first.',
  vision:
    "A data-focused Monitoring Dashboard that is easy to navigate, shows current programs from TRPA and its partners, connects to the rest of LT Info, and is built and maintained by TRPA with ESA's support.",
  roles:
    "Evelyn is project lead. Each lead makes the calls in their area, and Amy reviews the technical work. Jeanne is the project manager on the work order and gives final review on milestones and ESA scope and budget. If we can't agree, it goes to Jeanne, then Dan.",
  workflowIntro:
    "Three workstreams feed the dashboard build. Mason and Amy turn their work into pages, test them with the people who own the data, and move them through ESA's code process.",
  timelineIntro:
    'Milestones are numbered in date order. First we gather the category and program inventory and develop the program and data acceptance criteria. Then we create the master program list (Jan. 14), check and engineer the data, and review each program page with its owner, all before the preliminary dashboard on April 1. Two rounds of review follow before the May 12 launch.',
  meetingsIntro: 'Meetings happening now, then the ones that start later in the project.',
  stewardsIntro: 'Each monitoring category should have a data steward.',
  sources: 'Sources: project notes and ESA Work Order 004 (contract 27C00005, Oct. 22, 2026).',
} as const;

export const LINKS: readonly PlanLink[] = [
  { label: 'TRPA sandbox', href: 'https://trpa-agency.github.io/ltinfo-angular-sandbox/' },
  {
    label: 'monitoring-new.laketahoeinfo.org',
    href: 'https://monitoring-new.laketahoeinfo.org',
    note: 'protected development site',
  },
];

/** How the work is divided and who decides what. The rest of the plan follows from these. */
export const DECISIONS: readonly Decision[] = [
  {
    title: 'Who Decides',
    text: 'Each lead makes the calls and sets the dates in their area.',
    points: [
      "Evelyn: programs, data stewards, schedule, and Beth's program data with Andy",
      'Andy: data model, data engineering, integrations, and data viz',
      'Amy: web services, web development, and technical review',
      'Mason: web development and UX',
      'Thea: brand and design standards',
      'Jeanne: final review on milestones, and ESA scope and budget',
    ],
    note: "Can't agree? Jeanne, then Dan.",
  },
  {
    title: 'Building the Pages',
    text: "Amy and Mason build the pages together. They'll set the dates for Milestones 2 and 6 once the Shannon standups are rolling, since both depend on ESA.",
  },
  {
    title: 'Working With ESA',
    text: 'Mason is the main contact with ESA, and Amy joins the technical meetings. Anything that commits ESA to scope, dates, or budget goes through Jeanne.',
  },
  {
    title: 'Maintenance Plan',
    text: 'After launch, Amy and Mason maintain the dashboard code, and Andy maintains the data and pipelines, with support from Evelyn.',
  },
  {
    title: 'Shared Updates',
    text: "At the April review, Evelyn presents the team's work. Each lead gives a short update at the weekly Science and Data meeting as needed.",
  },
  {
    title: 'Data Management',
    points: [
      'Andy leads data management and keeps the team posted',
      'Data model: how each source comes in, gets processed, validated, and stored. Pipelines match it. Draft data acceptance criteria live there too',
      "Andy: data engineering for TRPA data outside Beth's program (Scenic, AIS, and others) and external integrations",
      "Evelyn and Andy: data engineering for Beth's program data, due Feb. 20 so Andy can check it before March 1",
      'Evelyn helps with data viz and works with program owners',
      'Amy leads web services',
      'Andy and Evelyn clean up the monitoring repo together, due March 1',
    ],
  },
  {
    title: 'Prototyping Sandbox',
    text: "Mason set up a TRPA sandbox (Angular and Docker) so we can prototype quickly with program leads and Evelyn. What works there gets built in ESA's repo, so ESA only reviews work we've already tested.",
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
    points: [
      'Updates appear in real time',
      'ESA no longer needs to host the data, except for transit ridership and stormwater tools data',
    ],
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
      { text: 'Final review on milestones' },
      { text: 'Signs off on ESA scope and budget' },
      { text: 'Runs bi-weekly LT Info meetings with ESA (Mason attends)' },
    ],
  },
  {
    title: 'Workstream Leads',
    lead: 'Decide within their areas.',
    points: [
      {
        who: 'Evelyn',
        text: "project lead for programs and data stewards, and tracks the schedule. Works with Andy on the data engineering for data from Beth's program, cleans up the monitoring repo with Andy, and helps with data viz. Runs the design sessions with Mason, pulls the feedback together, and recruits program leads.",
      },
      {
        who: 'Andy',
        text: "data model, data engineering, external data integrations, data viz, and analysis. Final say on data. Leads data engineering and processing for TRPA internal data outside the scope of Beth's field program, such as Scenic and AIS. Cleans up the monitoring repo with Evelyn.",
      },
      { who: 'Amy', text: 'web services, web development, and technical review of the work.' },
      {
        who: 'Mason',
        text: 'leads UX through user-centered design. Web development. Works with Jeanne to scope ESA work.',
      },
      { who: 'Thea', text: 'brand and design standards. Signs off on the design system.' },
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
      { text: 'Commitments to ESA on scope, dates, or budget go through Jeanne' },
      { who: 'Ray', text: 'development environment setup, with Amy' },
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
    next: 'Go over the inventory with Andy and Mason. In December, Evelyn sets the program acceptance criteria to line up with the data criteria. Milestone 3 (master program list): Jan. 14.',
    facts: [
      { label: 'Lead', value: 'Evelyn' },
      { label: 'Team', value: 'Andy, Amy, Mason; internal and external data stewards' },
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
    feeds: { to: 'data', what: "the master program list; owners are told what's displayed" },
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
        text: "Mason has Docker, SQL Server, and the Angular components running in a container. Reading the codebase with AI used a lot of tokens, so getting started with Shannon's guidance may be more efficient.",
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
          'Mason leads a user-centered design loop with program leads and Evelyn. Thea reviews and signs off. Evelyn runs the sessions with Mason, pulls the feedback together, and recruits and schedules program leads. Mason sets the session questions and decides what changes in the design.',
      },
      { label: 'ESA', value: 'Shannon' },
    ],
    work: [
      'Repo access, Docker, SQL Server, and Angular components (Mason and Amy)',
      'Mason and Amy build program pages and templates to LT Info conventions, with no one-off pages',
      'Page templates for each program type, and shared map, chart, table, and download components',
      'Home page, navigation, dropdowns, and sidebars',
      'Wire each page to TRPA services and views, then an accessibility and QA pass',
      "UX prototyping and user testing with program leads in the TRPA sandbox repo, then built in ESA's LT Info repo",
      'Mason and Amy submit pull requests into develop; never commit to main',
      'Mason and Amy maintain the dashboard code after launch',
      'Development milestone dates (2 and 6) confirmed by Mason and Amy after Shannon check-ins',
    ],
    flow: [
      { text: 'Amy and Mason: development setup and repo' },
      { text: 'Docker, SQL Server, and Angular', done: true },
      { text: 'Mason and Amy build pages', milestone: 2 },
      { text: 'Amy signs off the pull request into develop' },
      { text: 'ESA merges and releases to QA' },
      { text: 'Cutover to production (ESA)', milestone: 'final' },
    ],
    flowNotes: [
      'Focus groups and sandbox prototypes run alongside page building, in both directions (Milestone 5, March 25).',
      'Changes requested in review go back to page building.',
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
        text: 'Andy started the data model and drafted the data acceptance criteria. He leads data management and keeps the team posted. Amy leads web services.',
      },
    ],
    next: "Andy walks the team through the data model (Nov. 20). Evelyn starts on the data engineering for Beth's program with Andy on Dec. 1, with processing due Feb. 20. Milestone 4 (data ready in SQL): March 1.",
    facts: [
      {
        label: 'Lead',
        value:
          "Andy (data model, data engineering, external data integrations, data viz and analysis, final say on data, leads data engineering and processing for TRPA internal data outside Beth's field program, cleans up the monitoring repo with Evelyn)",
      },
      {
        label: 'Team',
        value:
          "Evelyn (works with Andy on data engineering for data from Beth's program of work, cleans up the monitoring repo with Andy, helps with data viz), Amy (web services and technical review), Mason (as needed)",
      },
      { label: 'ESA', value: 'None (internal)' },
      {
        label: 'Before engineering',
        value:
          "Data acceptance criteria are drafted and live in the data model. Andy checks program owners' data against them. Evelyn works with Andy on the data from Beth's program and works with program owners.",
      },
    ],
    work: [
      'Data model: documentation and a plan for how each data source is acquired, processed, and stored, plus the pipelines that do it (Andy)',
      'Data acceptance criteria (drafted, Andy)',
      "Data engineering for TRPA internal data outside Beth's program, such as Scenic and AIS (Andy)",
      "Data engineering for data from Beth's program (Evelyn with Andy, by Feb. 20)",
      'External data pipelines and integrations for partner sources, including RSWAMP and Transit (Andy)',
      'Data viz development for program pages (Andy leads, Evelyn helps)',
      'Monitoring repo cleanup to support internal and external monitoring data engineering (Andy and Evelyn, by March 1)',
      'SQL schema and data model',
      "How data is stored in SQL, including whether it's stacked, and how the views work",
      'How the data feeds into LT Info',
      'Move spreadsheets and feature classes to normalized tables with views',
      'A plan for how raw data feeds threshold attainment calls and the threshold evaluation',
      'Validation and live QA on incoming data (Amy leads)',
      'Clean up the LT Info Monitoring service (with Amy)',
      'Demographics as a self-service page, and retire the Tahoe Open Data demographics page (with Amy)',
      "Web service architecture: how TRPA's services feed the dashboard, LT Info, and Tahoe Open Data (Amy leads)",
      'Andy leads year-round maintenance of the data and data engineering after launch',
      'Andy debriefs the team as needed',
    ],
    flow: [
      { text: 'Program criteria; data criteria drafted', when: 'December' },
      { text: "Evelyn: Beth's data. Andy: all other data", when: 'From Jan. 14' },
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
        date: '2026-11-12',
        text: 'An example page built on the Ecology design standards is ready. Thea decides the branding and applies it. Thea and Mauricio kick off Monday, Nov. 16.',
      },
    ],
    next: 'Mason iterates on the example page with Thea as she sets the branding. Once the design standards are done, Mason runs the user-centered design loop with program leads, Evelyn facilitates those group sessions starting in February, and Thea signs off. Amy and Mason build from the sandbox. Milestone 1 (design standards): Jan. 1.',
    facts: [
      { label: 'Lead', value: 'Thea' },
      { label: 'Team', value: 'Jeanne (final review), Amy, Mason, Evelyn' },
      { label: 'ESA', value: 'Mauricio, through Thea' },
    ],
    work: [
      'An example page built on the Ecology design standards is ready for Thea to brand',
      'Thea decides the branding and applies it, after meeting with Mauricio',
      'Jeanne gives final approval before the standards become a Claude skill',
      'Once the standards are done, Mason runs a user-centered design loop with program leads, Evelyn facilitates, and Thea signs off',
      'Mauricio gives technical feedback at the ESA standup, and Mason and Amy tweak the design system fork as needed',
    ],
    flow: [
      { text: 'Ecology design standards' },
      { text: 'Example page', done: true },
      { text: 'Thea sets the branding' },
      { text: 'Jeanne gives final approval' },
      { text: 'Standards become a Claude skill', milestone: 1 },
      {
        text: 'Mason and program leads iterate on UX design; Evelyn facilitates',
        when: 'Mauricio gives feedback at the ESA standup',
      },
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
    done: 'Design standards: Thea sets the branding on the example page; Jeanne approves',
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
    done: 'Master list of programs we want to include, reviewed by Dan and Beth',
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
    done: 'Preliminary dashboard built; review and testing through April 20. Date confirmed by Mason and Amy after Shannon check-ins',
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
    text: "Gather the category and program inventory (due Nov. 18) and develop the program acceptance criteria (data acceptance criteria are drafted in the data model). Andy walks the team through the data model (Nov. 20). Evelyn starts on the data engineering for Beth's program with Andy on Dec. 1: she inventories the datasets (Dec. 4), and Andy and Evelyn audit the monitoring repo (Dec. 11), alongside the program acceptance criteria and steward meetings.",
  },
  {
    span: 'January to April 1',
    text: "Finalize the master program list using the acceptance criteria, after Dan and Beth review the draft (Jan. 14), and let program owners know what will be displayed. Evelyn maps the datasets from Beth's program for programs on the list to the data model (Jan. 22), writes the processing scripts (Feb. 12), and processes the data by Feb. 20, so Andy can check it before March 1. Andy and Evelyn finish the monitoring repo cleanup together by March 1. Andy leads getting data from program owners, the data engineering, and the data viz. The SQL schema is set by Feb. 5, the pipelines by Feb. 19, and validation checks by Feb. 26, so data is ready in SQL by March 1. Evelyn coordinates with program owners and helps with data viz starting Jan. 14. Amy and Mason build the pages throughout, starting in the LT Info framework (Jan. 4), and Amy delivers the cleaned-up LT Info Monitoring service by Jan. 29. Once the design standards are done, Mason runs the user-centered design loop with program leads. Evelyn facilitates the sessions starting in February and collates the feedback, and Thea signs off. Evelyn and Mason review each program page with its owner by March 25.",
  },
  {
    span: 'April 1 to 20',
    text: 'Dan, Beth, Jeanne, Thea, program leads, and others review the preliminary dashboard, comment, and test it.',
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
        who: 'Evelyn, Andy, Mason, Amy; Beth and Dan optional',
        cadence: 'Weekly, Thursday mornings',
        purpose:
          'Status across all workstreams, steward follow-ups, build and data tasks, and open pull requests. Mason and Amy relay updates from the Shannon standups, Evelyn updates on programs, and Andy updates on data work.',
      },
      {
        name: 'ESA development standup',
        who: 'Mason, Amy, Shannon; Mauricio as needed',
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
        who: 'Thea and Mauricio first. Then Mason runs the design loop with program leads, Evelyn facilitates, and Thea signs off',
        cadence: 'Kickoff Monday, Nov. 16, then as needed',
        cadenceNote:
          'Mauricio gives technical feedback at the ESA standup. Mason and Amy tweak the design system fork as needed',
        purpose:
          'Thea sets the branding on the example page. Jeanne gives final approval before the standards become a Claude skill.',
      },
      {
        name: 'Data model working session',
        who: 'Andy leads, with Evelyn, and Mason and Amy as needed',
        cadence: 'Starts with a data model meeting, then as needed',
        purpose:
          'Data model and SQL schema, whether data is stacked, how the views work and feed LT Info, raw data to threshold calls, validation, and cleaning up the LT Info Monitoring service.',
      },
      {
        name: 'Science and Data team meeting',
        who: 'Workstream leads give a short update to the wider team as needed',
        cadence: 'Weekly, as needed',
        purpose:
          'Progress against milestones, upcoming steward requests, and decisions the wider team should know about.',
      },
      {
        name: 'LT Info bi-weekly (Jeanne and ESA)',
        who: 'Jeanne runs the meeting with Julia or Liz. Mason attends and gives the update. Amy joins for technical topics',
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
        cadence: 'By Jan. 8, before the master list on Jan. 14',
        purpose: "Share what works and what doesn't against the program and data acceptance criteria.",
      },
      {
        name: 'Program page reviews',
        who: 'Mason with each program owner in the TRPA sandbox. Evelyn sets them up and facilitates',
        cadence: "Once a program's data is organized, by March 25",
        purpose:
          'Work out how each program comes across on the dashboard (Milestone 5). ESA reviews once or twice before launch.',
      },
      {
        name: 'UX focus groups',
        who: 'Evelyn runs them with Mason, with program leads and users',
        cadence: 'February to March, planned by Jan. 22',
        purpose:
          'User-centered design feedback on the page templates and sandbox pages. Mason sets the questions, Evelyn facilitates the sessions and collates the feedback, and Mason decides what changes in the design.',
      },
      {
        name: 'Leadership review',
        who: "Dan, Beth, Jeanne, Thea, program leads, and others. Evelyn presents the team's work",
        cadence: 'April 1 to 20, after the preliminary dashboard',
        purpose: 'Review, comment on, and test the preliminary dashboard on the protected test site.',
      },
      {
        name: 'Secondary dashboard review',
        who: 'Data team; Mauricio and ESA may weigh in',
        cadence: 'April 20 to May 12',
        purpose: 'Final comments before the May 12 launch.',
      },
      {
        name: 'Program owner check-ins after launch',
        who: 'Andy or Evelyn with monitoring program owners and data stewards',
        cadence: 'Quarterly after launch',
        purpose: 'Keep programs and data current, add new programs, and archive ended ones.',
      },
    ],
  },
];

export const ACTION_GROUPS: readonly { label: string; items: ActionItem[] }[] = [
  {
    label: 'Done',
    items: [
      {
        action: 'Build an example page from the Ecology design standards',
        owner: 'Mason',
        target: 'Nov. 12',
        status: 'done',
      },
      {
        action: 'Meet Shannon to get the build started and set up the development environment',
        owner: 'Mason',
        target: 'Friday, Nov. 13',
        status: 'done',
      },
      {
        action: 'Set up a TRPA sandbox repo (Angular and Docker) for prototyping with program leads',
        owner: 'Mason',
        target: 'Nov. 14',
        status: 'done',
      },
    ],
  },
  {
    label: 'Next Week (Nov. 16 to 20)',
    items: [
      {
        action: 'Send recurring invites for the internal meetings above',
        owner: 'Evelyn',
        target: 'Nov. 17',
        status: 'todo',
      },
      { action: 'Design system kickoff', owner: 'Thea, Mauricio', target: 'Monday, Nov. 16', status: 'scheduled' },
      {
        action:
          'Confirm the Jan. 1 design standards target (Milestone 1) at the kickoff, and have Thea set the branding on the example page',
        owner: 'Thea',
        target: 'Monday, Nov. 16',
        status: 'todo',
      },
      {
        action: 'Data steward meetings on current programs',
        owner: 'Evelyn, others as needed',
        target: 'Inventory due Nov. 18',
        status: 'scheduled',
      },
      {
        action: 'Andy walks the team through the data model',
        owner: 'Andy',
        target: 'Nov. 20',
        status: 'todo',
      },
      {
        action: 'Iterate on the example page with Thea as she sets the branding',
        owner: 'Mason, Thea, Mauricio (ESA)',
        target: 'Nov. 16 to Dec. 18',
        status: 'todo',
      },
      {
        action: 'Amy sets up her development environment',
        owner: 'Amy, Mason, Shannon (ESA)',
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
          'Document the development workflow (ESA coordination, branch naming, pull request checklist, and where tasks and testing are tracked without Jira) and share it with the team',
        owner: 'Mason, Amy',
        target: 'Nov. 20',
        status: 'todo',
      },
    ],
  },
  {
    label: 'By Early December',
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
        owner: 'Amy, Mason, with Shannon (ESA)',
        target: 'Nov. 30',
        status: 'todo',
      },
      {
        action: 'Confirm the Milestone 2 and 6 dates with Shannon',
        owner: 'Mason, Amy',
        target: 'Dec. 4',
        status: 'todo',
      },
    ],
  },
  {
    label: 'December to March',
    items: [
      {
        action: "Branded example page ready for Jeanne's review",
        owner: 'Thea, Mason',
        target: 'Dec. 18',
        status: 'todo',
      },
      { action: 'Approve the design standards (Milestone 1)', owner: 'Jeanne', target: 'Jan. 1', status: 'todo' },
      {
        action: 'Dashboard running in the LT Info framework (Milestone 2)',
        owner: 'Amy, Mason',
        target: 'Jan. 4',
        status: 'todo',
      },
      {
        action: 'Turn the approved design standards into a Claude skill',
        owner: 'Mason, Thea',
        target: 'Jan. 15',
        status: 'todo',
      },
      {
        action: 'Finish the data model document for every data source on the master list',
        owner: 'Andy',
        target: 'Jan. 29',
        status: 'todo',
      },
      {
        action: 'Page templates for each program type (such as time series, site map, and status)',
        owner: 'Amy, Mason',
        target: 'Jan. 29',
        status: 'todo',
      },
      {
        action: 'Shared components: map, chart, data table, and download',
        owner: 'Amy, Mason',
        target: 'Feb. 12',
        status: 'todo',
      },
      {
        action: 'Home page, navigation, dropdowns, and sidebars built in develop',
        owner: 'Mason, Amy',
        target: 'Feb. 26',
        status: 'todo',
      },
      {
        action: 'Wire each program page to TRPA services and views as data lands',
        owner: 'Amy, Mason',
        target: 'March 15',
        status: 'todo',
      },
      {
        action: 'Accessibility and QA pass on every page in develop',
        owner: 'Amy, Mason',
        target: 'March 25',
        status: 'todo',
      },
      {
        action:
          'Formalize conversations with external data stewards: Cara Moore (TRCD) and Sarah Mathews (TRCD), and possibly USFS, CTC, TERC, and UNR. Include RSWAMP, which is LT Info native data',
        owner: 'Evelyn, Andy',
        target: 'Jan. 8',
        status: 'todo',
      },
      {
        action: 'Set program acceptance criteria: type of program, whether it fits the dashboard, and who manages it',
        owner: 'Evelyn (Andy, Mason, and Beth help)',
        target: 'Dec. 11',
        status: 'todo',
      },
      {
        action:
          'Set data acceptance criteria: how data is stored and structured, completeness, partner access, validation, and live QA. No embedded dashboards from other sites. Lives in the data model',
        owner: 'Andy',
        target: 'Dec. 11',
        status: 'drafted',
      },
      {
        action: 'Review the brainstormed program list against the acceptance criteria and decide what makes sense',
        owner: 'Evelyn (Andy and Mason help)',
        target: 'Dec. 18',
        status: 'todo',
      },
      {
        action: "Pitch to data stewards what works and what doesn't",
        owner: 'Evelyn, Andy',
        target: 'Jan. 8',
        status: 'todo',
      },
      {
        action:
          'Dan and Beth review the draft master program list, so scope is settled before pages are built. Evelyn sends the draft and takes their comments',
        owner: 'Evelyn, Dan, Beth',
        target: 'Jan. 12',
        status: 'todo',
      },
      {
        action: 'Finalize the master program list using the acceptance criteria (Milestone 3)',
        owner: 'Evelyn (Andy and Mason help)',
        target: 'Jan. 14',
        status: 'todo',
      },
      {
        action: 'Let program owners know whether their program will be displayed on the dashboard',
        owner: 'Evelyn',
        target: 'Jan. 22',
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
        target: 'Feb. 5',
        status: 'todo',
      },
      {
        action:
          'Inventory external partner data sources for programs on the master list: source, access method (service, API, or file), owner, and update cadence',
        owner: 'Andy',
        target: 'Jan. 22',
        status: 'todo',
      },
      {
        action: 'Set up data access with each external partner. Evelyn coordinates with the stewards',
        owner: 'Andy',
        target: 'Feb. 5',
        status: 'todo',
      },
      {
        action:
          "Set up the data engineering and pipelines for TRPA internal data outside Beth's program, such as Scenic and AIS, as documented in the data model",
        owner: 'Andy',
        target: 'Feb. 19',
        status: 'todo',
      },
      {
        action:
          'External data pipelines and integrations for each partner source, including RSWAMP and Transit, as documented in the data model',
        owner: 'Andy, with Amy',
        target: 'Feb. 19',
        status: 'todo',
      },
      {
        action:
          "Inventory the datasets from Beth's program: source, format, owner, location, and update cadence for each",
        owner: 'Evelyn',
        target: 'Dec. 4',
        status: 'todo',
      },
      {
        action: 'Audit the monitoring repo: list folders, scripts, and data, and mark each keep, move, or archive',
        owner: 'Andy, Evelyn',
        target: 'Dec. 11',
        status: 'todo',
      },
      {
        action:
          "Map each dataset from Beth's program for programs on the master list to the data model and the data acceptance criteria",
        owner: 'Andy, Evelyn',
        target: 'Jan. 22',
        status: 'todo',
      },
      {
        action:
          "Write or clean up the processing scripts for each dataset from Beth's program in the monitoring repo",
        owner: 'Andy, Evelyn',
        target: 'Feb. 12',
        status: 'todo',
      },
      {
        action:
          "Data from Beth's program for programs on the master list processed into the data model, following the data acceptance criteria",
        owner: 'Andy, Evelyn',
        target: 'Feb. 20',
        status: 'todo',
      },
      {
        action: 'Clean up the monitoring repo so it supports internal and external monitoring data engineering',
        owner: 'Andy, Evelyn',
        target: 'March 1',
        status: 'todo',
      },
      {
        action: 'Plan the user-centered design focus groups: participants, questions, and schedule',
        owner: 'Evelyn, Mason',
        target: 'Jan. 22',
        status: 'todo',
      },
      {
        action:
          'Facilitate user-centered design sessions with program leads and users, and collate the feedback for Mason, who decides the design changes',
        owner: 'Evelyn (facilitates), Mason',
        target: 'February to March',
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
        action: 'Cleaned-up LT Info Monitoring service',
        owner: 'Amy, with Andy',
        target: 'Jan. 29',
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
        action:
          'Develop the data visualizations for each program page, matched to the data model. Evelyn helps starting Jan. 14',
        owner: 'Andy, Evelyn',
        target: 'Jan. 14 to March 15',
        status: 'todo',
      },
      {
        action:
          'Repackage demographics as a self-service page, and retire the Tahoe Open Data demographics page',
        owner: 'Andy, Amy',
        target: 'March 15',
        status: 'todo',
      },
      {
        action:
          'Automated validation checks on incoming data (service down, null values, wrong year), with alerts to the data team',
        owner: 'Amy (lead), Andy',
        target: 'Feb. 26',
        status: 'todo',
      },
      {
        action:
          "Book the April 1 to 20 review and testing with Dan, Beth, Jeanne, Thea, program leads, and others, so it's on their calendars early",
        owner: 'Evelyn',
        target: 'Jan. 15',
        status: 'todo',
      },
    ],
  },
  {
    label: 'April to June',
    items: [
      {
        action: 'Program pages built for every program on the master list (Milestone 6)',
        owner: 'Amy, Mason',
        target: 'April 1',
        status: 'todo',
      },
      {
        action:
          'Written cutover and release plan from ESA for May 12, with the last pull requests merged a week or two ahead',
        owner: 'Mason, Amy',
        target: 'March 15',
        status: 'todo',
      },
      { action: 'Build demo for the April leadership review', owner: 'Amy', target: 'April 1', status: 'todo' },
      {
        action: 'Evelyn collects team comments on the secondary dashboard and presents them to leadership',
        owner: 'Evelyn',
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
      {
        action: 'Data maintenance plan: update cadence and owner for each data source',
        owner: 'Andy',
        target: 'May 12',
        status: 'todo',
      },
      {
        action: 'Plan for how raw data feeds threshold attainment calls and the threshold evaluation',
        owner: 'Andy',
        target: 'June 30',
        status: 'todo',
      },
    ],
  },
  {
    label: 'Ongoing',
    items: [
      {
        action:
          'Program owner check-ins after launch: keep programs and data current, add new programs, and archive ended ones',
        owner: 'Andy or Evelyn',
        target: 'Quarterly from August 2027',
        status: 'todo',
      },
      {
        action:
          "Technical review of every TRPA pull request before it goes to ESA, using the review checklist. Mason and Amy review each other's pull requests, Amy signs off, and Shannon and Ray review for ESA",
        owner: 'Amy, Mason, Shannon, Ray (ESA)',
        target: 'Ongoing',
        status: 'todo',
      },
      {
        action: 'Track ESA hours against the $20,000 work order budget',
        owner: 'Jeanne',
        target: 'Ongoing',
        status: 'todo',
      },
      {
        action:
          "Keep ESA meetings short, cancel them when there's nothing to discuss, and use Shannon's guidance rather than having AI read the whole codebase",
        owner: 'Amy, Mason, Shannon (ESA)',
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

/** Monitoring categories and their data stewards, by organization. An empty list is a steward still to assign. */
export const STEWARDS: readonly { category: string; stewards: StewardGroup[] }[] = [
  { category: 'Air Quality', stewards: [{ org: 'TRPA', people: ['Beth', 'Evelyn'] }] },
  {
    category: 'Aquatic Invasive Species',
    stewards: [
      { org: 'TRPA', people: ['Emily', 'Andy'] },
      { org: 'TRCD', people: ['Sarah M.'] },
    ],
  },
  { category: 'Biodiversity', stewards: [{ org: 'TRPA', people: ['Beth', 'Andy'] }] },
  { category: 'Climate and Lake Conditions', stewards: [{ org: 'TRPA', people: ['Andy', 'Mason'] }] },
  { category: 'Fire Dynamics', stewards: [{ org: 'TRPA', people: ['Mason', 'Andy'] }] },
  { category: 'Fisheries', stewards: [{ org: 'TRPA', people: ['Andy', 'Beth'] }] },
  {
    category: 'Forest Structure',
    stewards: [
      { org: 'TRPA', people: ['Mason'] },
      { org: 'TRCD', people: ['Cara'] },
    ],
  },
  { category: 'Housing and Economy', stewards: [{ org: 'TRPA', people: ['Andy', 'Mason', 'Josh'] }] },
  { category: 'Noise', stewards: [{ org: 'TRPA', people: ['Andy', 'Beth'] }] },
  { category: 'Recreation', stewards: [{ org: 'TRPA', people: ['Devin', 'Amy'] }] },
  { category: 'Scenic', stewards: [{ org: 'TRPA', people: ['Andy', 'Jeanne'] }] },
  { category: 'Soils', stewards: [{ org: 'TRPA', people: ['Beth', 'Evelyn', 'Mason', 'Andy'] }] },
  { category: 'Transportation', stewards: [{ org: 'TRPA', people: ['Rachael', 'Josh', 'Kira', 'Rory'] }] },
  { category: 'Uncommon and Sensitive Plants', stewards: [{ org: 'TRPA', people: ['Beth', 'Mason'] }] },
  { category: 'Water Quality', stewards: [{ org: 'TRPA', people: ['Evelyn', 'Dan'] }] },
  { category: 'Wildlife', stewards: [{ org: 'TRPA', people: ['Beth', 'Evelyn'] }] },
  { category: 'Demographics', stewards: [{ org: 'TRPA', people: ['Andy', 'Josh'] }] },
  { category: 'Other (no category fits)', stewards: [{ org: 'TRPA', people: ['Mason', 'Evelyn', 'Andy', 'Amy'] }] },
];

/** A category's stewards on one line: "TRPA (Emily, Andy), TRCD (Sarah M.)". Empty when none is assigned. */
export const stewardLine = (groups: readonly StewardGroup[]): string =>
  groups.map((g) => `${g.org} (${g.people.join(', ')})`).join(', ');

export const workstreamById = (id: WorkstreamId): Workstream => {
  const found = WORKSTREAMS.find((w) => w.id === id);
  if (!found) throw new Error(`No workstream with the ID ${id}`);
  return found;
};

/** The milestones a workstream delivers, in date order. */
export const milestonesOf = (id: WorkstreamId): Milestone[] => MILESTONES.filter((m) => m.owner === id);

/** How many action items have each status. */
export const actionTally = (): Record<ActionStatus, number> => {
  const tally: Record<ActionStatus, number> = { done: 0, scheduled: 0, drafted: 0, todo: 0 };
  for (const group of ACTION_GROUPS) for (const item of group.items) tally[item.status] += 1;
  return tally;
};
