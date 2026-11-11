import { Directive, computed, input } from '@angular/core';

import type { DashboardConfig, MonitoringProgramDetail } from '../../api/models';
import { TileTracker } from '../summary-tiles/tile-tracker';
import { ProgramData, programData } from './program-data';
import { paragraphs } from './program-text';

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

  /** Measures, spans, the sites config, and the sites-per-year chart. */
  protected readonly data = computed<ProgramData>(() =>
    programData(this.name(), this.color(), this.config()),
  );

  /** Folds the panel outputs into the four summary tiles. */
  protected readonly tracker = new TileTracker(
    computed(() => this.data().sites !== null),
    computed(() => this.data().chartKeys),
  );

  /** Every photo but the key photo: what the gallery shows. */
  protected readonly galleryPhotos = computed(() => this.program().Images.slice(1));

  protected readonly description = computed(() =>
    paragraphs(this.program().MonitoringProgramDescription),
  );
  protected readonly approach = computed(() => paragraphs(this.program().MonitoringApproach));
}
