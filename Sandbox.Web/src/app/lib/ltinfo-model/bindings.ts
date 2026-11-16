// Which proposed table holds each planned use, and what the planned uses ask of those tables.
// Pure logic, no DOM and no Angular, so the Playwright "unit" project can run it in Node.
//
// Two tables are proposed, and neither exists yet:
//   IndicatorDataSource     keyed to an indicator: a chart, or a site's record over time. These
//                           are measurements, so the rule gives each one an indicator.
//   MonitoringProgramLayer  keyed to a program: its site list, its sites per year, its map and
//                           its map overlays. These say where a program works, not what it measured.

import type { PlannedUse, UseKind } from "./lineage";
import { USE_LABELS } from "./lineage";

export type BindingTable = "indicator-data-source" | "program-layer";

export const BINDING_TABLE_NAMES: Record<BindingTable, string> = {
    "indicator-data-source": "IndicatorDataSource",
    "program-layer": "MonitoringProgramLayer",
};

/** What a row of the table is tied to. */
export const BINDING_TABLE_KEYS: Record<BindingTable, string> = {
    "indicator-data-source": "Indicator",
    "program-layer": "Program",
};

const TABLE_OF: Record<UseKind, BindingTable> = {
    chart: "indicator-data-source",
    profile: "indicator-data-source",
    sites: "program-layer",
    "sites-per-year": "program-layer",
    map: "program-layer",
    overlay: "program-layer",
};

/** The table a use of this kind is bound through. */
export const bindingTableOf = (kind: UseKind): BindingTable => TABLE_OF[kind];

export interface BindingCoverageRow {
    kind: UseKind;
    label: string;
    table: BindingTable;
    tableName: string;
    keyedTo: string;
    uses: number;
    programs: number;
}

/** The order the page lists the kinds in: measurements first, then the layers of a program. */
const KIND_ORDER: readonly UseKind[] = ["chart", "profile", "sites", "sites-per-year", "map", "overlay"];

/** Every kind of use with the table that holds it and how many are planned. A kind with none still lists. */
export function bindingCoverage(uses: readonly PlannedUse[]): BindingCoverageRow[] {
    return KIND_ORDER.map((kind) => {
        const ofKind = uses.filter((use) => use.Kind === kind);
        const table = bindingTableOf(kind);
        return {
            kind,
            label: USE_LABELS[kind],
            table,
            tableName: BINDING_TABLE_NAMES[table],
            keyedTo: BINDING_TABLE_KEYS[table],
            uses: ofKind.length,
            programs: new Set(ofKind.map((use) => use.MonitoringProgramID)).size,
        };
    });
}

/** What the planned uses need that one layer with one value field could not hold. */
export interface BindingNeeds {
    charts: number;
    /** Charts that draw more than one value column, so the table holds a list of value fields. */
    chartsWithSeveralValueFields: number;
    /** Charts that ask the service for a sum, an average or a count, so the table holds a statistic. */
    chartsWithStatistic: number;
    /** Charts that reshape a group of columns in the page; that stays in the chart settings. */
    chartsReshaped: number;
    /** Programs that plan both a site list and at least one chart on a service. */
    programsWithSitesAndCharts: number;
    /** Of those, the programs whose site list reads a layer none of its charts read. */
    programsWithSeparateSitesLayer: number;
    /** Uses bound to an indicator, and uses bound to a program. */
    indicatorUses: number;
    programLayerUses: number;
}

const layerKey = (use: PlannedUse): string => `${use.Source}|${use.Layer}`;

export function bindingNeeds(uses: readonly PlannedUse[]): BindingNeeds {
    const charts = uses.filter((use) => use.Kind === "chart");

    const chartLayersByProgram = new Map<number, Set<string>>();
    for (const chart of charts) {
        if (chart.SourceKind !== "service") {
            continue;
        }
        const layers = chartLayersByProgram.get(chart.MonitoringProgramID) ?? new Set<string>();
        layers.add(layerKey(chart));
        chartLayersByProgram.set(chart.MonitoringProgramID, layers);
    }
    const sitesWithCharts = uses.filter((use) => use.Kind === "sites" && chartLayersByProgram.has(use.MonitoringProgramID));

    return {
        charts: charts.length,
        chartsWithSeveralValueFields: charts.filter((use) => (use.ValueFields ?? []).length > 1).length,
        chartsWithStatistic: charts.filter((use) => use.Statistic !== "").length,
        chartsReshaped: charts.filter((use) => use.VirtualFields.length > 0).length,
        programsWithSitesAndCharts: new Set(sitesWithCharts.map((use) => use.MonitoringProgramID)).size,
        programsWithSeparateSitesLayer: new Set(sitesWithCharts.filter((use) => !chartLayersByProgram.get(use.MonitoringProgramID)!.has(layerKey(use))).map((use) => use.MonitoringProgramID)).size,
        indicatorUses: uses.filter((use) => bindingTableOf(use.Kind) === "indicator-data-source").length,
        programLayerUses: uses.filter((use) => bindingTableOf(use.Kind) === "program-layer").length,
    };
}
