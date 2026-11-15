import { Directive, computed, input, signal } from '@angular/core';

import type { DashboardConfig, MonitoringProgramDetail } from '../../api/models';
import { TileTracker } from '../summary-tiles/tile-tracker';
import type { FilterState } from '../../lib/page-filters';
import { ProgramData, programData } from './program-data';
import { leadParagraph, paragraphs } from './program-text';

const sameConfig = (a: DashboardConfig | null, b: DashboardConfig | null): boolean =>
  a === b || JSON.stringify(a) === JSON.stringify(b);

/**
 * What the three page templates share: the program, the data its panels need,
 * the tile tracker, and the photos and text split the way the blocks take them.
 * Each template extends this and adds only its own composition (HTML and SCSS).
 */
@Directive()
export abstract class TemplateBase {
  readonly program = input.required<MonitoringProgramDetail>();

  // Saving Featured or the layout replaces the program object. The name, the
  // color, and the config are compared by value, so a save does not hand the
  // panels new objects and make them load again.
  private readonly name = computed(() => this.program().MonitoringProgramName);
  // One data color for every program's sites (Ecology: color only in data, never per
  // category). The Threshold Dashboard theme color (ThemeColor) is not used on the map.
  private readonly color = computed(() => 'var(--color-background-dataviz-categorical-1)');
  private readonly config = computed(() => this.program().DashboardConfig, { equal: sameConfig });

  /** The option chosen in each page filter, by field. Empty: nothing is filtered. */
  protected readonly chosen = signal<FilterState>({});

  /** Measures, spans, the sites config, and the sites-per-year chart, with the chosen filters applied. */
  protected readonly data = computed<ProgramData>(() =>
    programData(this.name(), this.color(), this.config(), this.chosen()),
  );

  /** A filter changed: the map and the charts on its layer load again. An empty label clears it. */
  protected choose(change: { field: string; label: string }): void {
    const next: Record<string, string> = { ...this.chosen() };
    delete next[change.field];
    if (change.label) next[change.field] = change.label;
    this.chosen.set(next);
  }

  /** Folds the panel outputs into the summary tiles; the first measure gives the headline. */
  protected readonly tracker = new TileTracker(
    computed(() => this.data().sites !== null),
    computed(() => this.data().chartKeys),
    computed(() => this.data().measures[0] ?? null),
  );

  /** Every photo but the key photo: what the gallery shows. */
  protected readonly galleryPhotos = computed(() => this.program().Images.slice(1));

  protected readonly description = computed(() =>
    paragraphs(this.program().MonitoringProgramDescription),
  );
  protected readonly approach = computed(() => paragraphs(this.program().MonitoringApproach));

  /**
   * The first paragraph of the description, shown under the name in the header, so the page
   * says what the program is before it shows a chart. Only a short statement makes a lead; a
   * long paragraph, a heading, or a question stays in the story.
   */
  protected readonly lead = computed(() => leadParagraph(this.description()));

  /** The description after the lead, for the story card. */
  protected readonly restOfDescription = computed(() =>
    this.lead() === null ? this.description() : this.description().slice(1),
  );

  /** The program's pages on the other LT Info dashboards, linked from the header. */
  protected readonly links = computed(() => this.program().RelatedLinks ?? []);
}
