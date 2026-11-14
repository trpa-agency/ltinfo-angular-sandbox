import type { DashboardConfig } from '../../api/models';
import {
  Measure,
  MeasureSpan,
  PanelSource,
  panelSpans,
  sitesPerYearMeasure,
} from '../../lib/measures';
import type { SitesPanelConfig } from '../../lib/sites';

/** The key the tile tracker knows the sites-per-year chart by. */
export const SITES_PER_YEAR_KEY = 'sites-per-year';

/** The key the tile tracker knows the chart of measure number `index` by. */
export const measureKey = (index: number): string => `measure-${index}`;

/** House wording for a section with nothing to show: what is absent, then what the section will show. */
export const EMPTY_TEXT = {
  measurements: {
    title: 'No measurements loaded yet',
    description:
      'This section will show measurement charts from the TRPA map service, each with a table view and a CSV download.',
  },
  sitesPerYear: {
    title: 'No site records loaded yet',
    description: 'This section will show how many sites were monitored in each year of the record.',
  },
  partners: {
    title: 'No partners loaded yet',
    description: 'This section will show the partner organizations from Lake Tahoe Info.',
  },
  about: {
    title: 'No program description loaded yet',
    description:
      'This section will show the monitoring approach and program description from Lake Tahoe Info.',
  },
} as const;

/**
 * What the data panels of one program need, worked out once from its
 * DashboardConfig. The panels reload when an input object changes, so every
 * object here is built one time per config and then handed to the panels as is.
 */
export interface ProgramData {
  /** One chart per measure. */
  measures: Measure[];
  /** span-6 or span-12 for each measure, from panelSpans. */
  spans: MeasureSpan[];
  /** Null when the program has neither a sitesLayer nor a mapLayer. */
  sites: SitesPanelConfig | null;
  /** The "sites monitored each year" chart, or null when the program has no sitesPerYear. */
  perYear: { measure: Measure; source: PanelSource } | null;
  /** One key per chart panel that will be on the page, for the tile tracker. */
  chartKeys: string[];
}

export function programData(
  name: string,
  color: string,
  config: DashboardConfig | null,
): ProgramData {
  const measures = config?.measures ?? [];
  const perYearConfig = config?.sitesPerYear;
  const perYear = perYearConfig
    ? {
        measure: sitesPerYearMeasure(perYearConfig),
        source: { kind: 'sites-per-year', config: perYearConfig } satisfies PanelSource,
      }
    : null;
  const sites: SitesPanelConfig | null =
    config?.sitesLayer || config?.mapLayer
      ? {
          program: name,
          color,
          sitesLayer: config.sitesLayer,
          mapLayer: config.mapLayer,
          overlays: config.overlays,
          siteProfile: config.siteProfile ?? null,
        }
      : null;

  return {
    measures,
    spans: panelSpans(measures),
    sites,
    perYear,
    chartKeys: [...measures.map((_, index) => measureKey(index)), ...(perYear ? [SITES_PER_YEAR_KEY] : [])],
  };
}
