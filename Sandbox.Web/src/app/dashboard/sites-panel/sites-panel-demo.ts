import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { forkJoin } from 'rxjs';

import { failed, LoadState, ready } from '../../api/load-state';
import { MonitoringProgramDetail } from '../../api/models';
import { SandboxApiService } from '../../api/sandbox-api.service';
import { EsaBadge, EsaBadgeVariant } from '../../ecology/esa-badge';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import type { PanelState, SitesPanelConfig, SitesSummary } from '../../lib/sites';
import { SitesPanel } from './sites-panel';

/** One panel on the page: what it shows, what to check by hand, and the config it is given. */
interface DemoCase {
  id: string;
  title: string;
  /** What this case exercises. */
  note: string;
  /** What to try by hand. */
  checks: string[];
  config: SitesPanelConfig;
  tall: boolean;
}

/** What the panel has reported through its two outputs, shown under each case. */
interface DemoReport {
  state: PanelState | null;
  summary: SitesSummary | null;
  loadedCount: number;
}

/** The real programs behind the cases, by LT Info program id. */
const PROGRAM_IDS = { tyc: 39, sez: 49, sav: 9034, streams: 63 } as const;

const STATE_VARIANT: Record<PanelState, EsaBadgeVariant> = {
  loading: 'info',
  ready: 'success',
  empty: 'neutral',
  error: 'danger',
};

/** A program from the API as the panel's config: its name, its category color, and its layer keys unchanged. */
function panelConfig(program: MonitoringProgramDetail): SitesPanelConfig {
  const config = program.DashboardConfig ?? {};
  return {
    program: program.MonitoringProgramName,
    color: program.ThemeColor,
    sitesLayer: config.sitesLayer,
    mapLayer: config.mapLayer,
    overlays: config.overlays,
    siteProfile: config.siteProfile ?? null,
  };
}

function buildCases(programs: Record<keyof typeof PROGRAM_IDS, MonitoringProgramDetail>): DemoCase[] {
  const tyc = panelConfig(programs.tyc);
  return [
    {
      id: 'tyc',
      title: `Sites with an overlay: ${programs.tyc.MonitoringProgramName}`,
      note: 'A sitesLayer with one feature per site per year, collapsed to one marker per site, over a lake-level overlay.',
      checks: [
        'Click a row: the map flies to the site and opens its popup.',
        'Click a marker: its row is marked and scrolls into view.',
        'Scroll the page with the pointer over the map: the page moves, the map does not zoom.',
        'Switch to Aerial in the layers control, then use Home to return to all sites.',
      ],
      config: tyc,
      tall: false,
    },
    {
      id: 'sez',
      title: `Areas with a year pick: ${programs.sez.MonitoringProgramName}`,
      note: 'A mapLayer of assessment-unit polygons colored by rating, one evaluation year at a time. One year is about 2.9 MB of generalized GeoJSON.',
      checks: [
        'Change the evaluation year: the polygons, the list groups, and the summary below all change.',
        'Search the list for a creek name, then click a result.',
        'Download the CSV and check that it holds the year on screen.',
      ],
      config: panelConfig(programs.sez),
      tall: false,
    },
    {
      id: 'sav',
      title: `No list: ${programs.sav.MonitoringProgramName}`,
      note: 'A mapLayer with list set to false, so the map fills the card. About 21,400 small polygons arrive over 11 requests and draw on a canvas.',
      checks: ['The loading state counts the patches received so far.', 'Zoom in near the Tahoe Keys and click a patch for its popup.'],
      config: panelConfig(programs.sav),
      tall: false,
    },
    {
      id: 'tall',
      title: `Tall map, several statuses: ${programs.streams.MonitoringProgramName}`,
      note: 'The tall input, as the map template uses it, on a sitesLayer with a status field: one color and one list group per status.',
      checks: ['The list is exactly as tall as the map.', 'Each status has its own color in the legend, the markers, and the list dots.'],
      config: panelConfig(programs.streams),
      tall: true,
    },
    {
      id: 'error',
      title: 'Error state: a layer that does not exist',
      note: 'The Tahoe Yellow Cress config pointed at layer 9999. The service answers 404, which is the one console error this page expects.',
      checks: ['The panel says the data could not be loaded and the CSV button is disabled.'],
      config: { program: tyc.program, color: tyc.color, sitesLayer: { ...tyc.sitesLayer!, layer: 9999 } },
      tall: false,
    },
    {
      id: 'empty',
      title: 'Empty state: a program with no site source',
      note: 'A config with a program name and color only, as a program without sitesLayer or mapLayer has.',
      checks: ['The panel says no sites are loaded yet and makes no request.'],
      config: { program: 'A program without sites', color: tyc.color },
      tall: false,
    },
  ];
}

// The showcase and manual test page for the sites panel, at /dev/map. Every case is a real
// program read through the sandbox API, so the panel gets the config a page template would
// hand it. The line under each panel is what the panel reported through (settled) and (loaded).
@Component({
  selector: 'app-sites-panel-demo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EsaBadge, EsaCard, EsaEmptyState, SitesPanel],
  templateUrl: './sites-panel-demo.html',
  styleUrl: './sites-panel-demo.scss',
})
export class SitesPanelDemo {
  private readonly api = inject(SandboxApiService);

  protected readonly cases = signal<LoadState<DemoCase[]>>({ status: 'loading' });
  protected readonly reports = signal<Record<string, DemoReport>>({});
  protected readonly stateVariant = STATE_VARIANT;

  constructor() {
    forkJoin({
      tyc: this.api.getProgram(PROGRAM_IDS.tyc),
      sez: this.api.getProgram(PROGRAM_IDS.sez),
      sav: this.api.getProgram(PROGRAM_IDS.sav),
      streams: this.api.getProgram(PROGRAM_IDS.streams),
    }).subscribe({
      next: (programs) => this.cases.set(ready(buildCases(programs))),
      error: (error: unknown) => this.cases.set(failed(error)),
    });
  }

  protected report(id: string): DemoReport {
    return this.reports()[id] ?? { state: null, summary: null, loadedCount: 0 };
  }

  protected onSettled(id: string, state: PanelState): void {
    this.reports.update((all) => ({ ...all, [id]: { ...this.report(id), state } }));
  }

  protected onLoaded(id: string, summary: SitesSummary): void {
    const before = this.report(id);
    this.reports.update((all) => ({ ...all, [id]: { ...before, summary, loadedCount: before.loadedCount + 1 } }));
  }

  /** "65 sites, 65 mapped, 1979 to 2025" from a summary. */
  protected summaryText(summary: SitesSummary): string {
    const n = (value: number) => value.toLocaleString('en-US');
    const parts = [`${n(summary.total)} ${summary.unitPlural.toLowerCase()}`, `${n(summary.mapped)} mapped`];
    if (summary.active != null) parts.push(`${n(summary.active)} active`);
    if (summary.picked != null) parts.push(`pick ${summary.picked}`);
    if (summary.years.length) {
      const first = summary.years[0];
      const last = summary.years[summary.years.length - 1];
      parts.push(first === last ? `${first}` : `${first} to ${last}`);
    }
    return parts.join(', ');
  }
}
