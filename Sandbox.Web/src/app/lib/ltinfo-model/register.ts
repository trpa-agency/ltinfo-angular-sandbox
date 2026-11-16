// The indicator register behind the Data Model page: every planned chart, every program and every
// indicator, each with what LT Info holds for it today and the next step toward the rule that a
// chart is an indicator in LT Info fed by a map service. Pure logic, no DOM and no Angular, so the
// Playwright "unit" project can run it in Node.

import type { MonitoringNewDataModel, MonitoringNewDataSourceSimple, MonitoringNewIndicatorSource, MonitoringNewProgramGridRow } from "./ltinfo-dto";
import { classify, pathById } from "./ingest";
import type { PlannedSources, PlannedUse } from "./lineage";
import { buildLineage, layerHref } from "./lineage";

/** The first thing still to do for a chart or a program, in the order the steps have to happen. */
export type NextStep = "program" | "indicator" | "service" | "bind" | "plan" | "none";

export const NEXT_STEP_LABELS: Record<NextStep, string> = {
    program: "Add the program to LT Info",
    indicator: "Add an indicator",
    service: "Publish the data as a map service",
    bind: "Bind an indicator to the layer",
    plan: "Plan a chart",
    none: "Nothing planned",
};

/** Where an indicator's numbers come from in LT Info today. */
export type IndicatorToday = "calculated" | "project" | "stored" | "embedded" | "none";

export const TODAY_LABELS: Record<IndicatorToday, string> = {
    calculated: "Calculated by LT Info",
    project: "Reported by EIP projects",
    stored: "Values stored in LT Info",
    embedded: "Embedded chart page",
    none: "No data",
};

/** One planned chart: the unit that needs an indicator. */
export interface ChartRow {
    MonitoringProgramID: number;
    /** The program's ID when LT Info has it, so the grid links only to pages that exist. */
    ProgramLinkID: number | null;
    ProgramName: string;
    InLtInfo: boolean;
    CategoryName: string;
    Title: string;
    SourceName: string;
    SourceKindLabel: string;
    Layer: number | null;
    /** The layer's page in the service directory; empty for a file. */
    LayerHref: string;
    PathLabel: string;
    Fields: string;
    Where: string;
    Upstream: string;
    /** Active indicators linked to the chart's program. */
    IndicatorCount: number;
    IndicatorNames: string;
    NextStep: NextStep;
    NextStepLabel: string;
}

/** One program, in LT Info or only planned. */
export interface ProgramRow {
    MonitoringProgramID: number;
    /** The program's ID when LT Info has it, so the grid links only to pages that exist. */
    ProgramLinkID: number | null;
    ProgramName: string;
    /** The name the redesign plans, when it differs from the LT Info name. */
    PlannedName: string;
    InLtInfo: boolean;
    CategoryName: string;
    IndicatorCount: number;
    IndicatorNames: string;
    /** Active indicators with a matching name that are not linked to the program. */
    SuggestedIndicators: string;
    PlannedCharts: number;
    ChartsOnServices: number;
    ChartsOnFiles: number;
    /** Sources LT Info already reads on a schedule for the program. */
    ScheduledSources: number;
    NextStep: NextStep;
    NextStepLabel: string;
}

/** One active indicator. */
export interface IndicatorRow {
    IndicatorID: number;
    IndicatorDisplayName: string;
    IndicatorTypeDisplayName: string;
    MeasurementUnitTypeDisplayName: string;
    DataSourceType: string;
    Today: IndicatorToday;
    TodayLabel: string;
    ReportedValueCount: number;
    ChartSourceURL: string;
    ProgramCount: number;
    ProgramNames: string;
    /** Planned charts on the indicator's programs. */
    PlannedCharts: number;
    /** The other LT Info dashboards that report the indicator. */
    Dashboards: string;
}

/** One source LT Info reads on a schedule today. */
export interface ScheduledSourceRow {
    MonitoringDataSourceID: number;
    MonitoringDataSourceName: string;
    /** "Map service", "Partner API" or "Entered by hand". */
    Kind: string;
    MonitoringDataSourceLocation: string;
    MonitoringProgramID: number | null;
    ProgramName: string;
    LastRunDate: string | null;
    LastRunStatus: string;
    LastChangeDate: string | null;
}

export interface RegisterTotals {
    /** Programs in LT Info. */
    programs: number;
    programsWithIndicator: number;
    /** Programs the redesign plans that LT Info does not have. */
    programsToAdd: number;
    /** Active indicators linked to at least one program. */
    linkedIndicators: number;
    linkedStored: number;
    linkedEmbedded: number;
    linkedNoData: number;
    plannedCharts: number;
    chartsOnServices: number;
    chartsOnFiles: number;
    /** Planned charts whose program is in LT Info, has an indicator, and reads a map service. */
    chartsReadyToBind: number;
    /** Scheduled sources that read an address, and how many of those are map service layers. */
    scheduledSources: number;
    scheduledMapServiceLayers: number;
    /** Indicators bound to a map service layer. None until the binding table exists. */
    boundIndicators: number;
}

export interface Register {
    charts: ChartRow[];
    programs: ProgramRow[];
    indicators: IndicatorRow[];
    scheduledSources: ScheduledSourceRow[];
    totals: RegisterTotals;
}

export function indicatorToday(indicator: Pick<MonitoringNewIndicatorSource, "IsCustomCalculation" | "IndicatorDataSourceTypeDisplayName" | "ReportedValueCount" | "ChartSourceURL">): IndicatorToday {
    if (indicator.IsCustomCalculation) {
        return "calculated";
    }
    if (indicator.IndicatorDataSourceTypeDisplayName === "Project") {
        return "project";
    }
    if (indicator.ReportedValueCount > 0) {
        return "stored";
    }
    return indicator.ChartSourceURL ? "embedded" : "none";
}

/** The first open step for a planned chart. */
export function chartNextStep(chart: { inLtInfo: boolean; indicatorCount: number; onService: boolean }): NextStep {
    if (!chart.inLtInfo) {
        return "program";
    }
    if (chart.indicatorCount === 0) {
        return "indicator";
    }
    return chart.onService ? "bind" : "service";
}

/** The first open step for a program. */
export function programNextStep(program: { inLtInfo: boolean; indicatorCount: number; plannedCharts: number; chartsOnFiles: number }): NextStep {
    if (!program.inLtInfo) {
        return "program";
    }
    if (program.plannedCharts === 0) {
        return program.indicatorCount > 0 ? "plan" : "none";
    }
    if (program.indicatorCount === 0) {
        return "indicator";
    }
    return program.chartsOnFiles > 0 ? "service" : "bind";
}

// Words that say nothing about what is measured.
const STOP_WORDS = new Set(["monitoring", "program", "programs", "the", "of", "and", "in", "for", "to", "by", "a", "an", "at", "on", "lake", "tahoe", "trpa", "sites", "site", "population"]);

/** The words of a name that carry meaning, lower case. */
export function nameTokens(name: string): string[] {
    return name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, " ")
        .split(" ")
        .filter((word) => word.length > 1 && !STOP_WORDS.has(word));
}

/**
 * Indicators whose name holds every meaningful word of the program name, or the other way round.
 * A one-word name only counts when the word is at least five letters, so "PM" or "Age" match nothing.
 */
export function suggestIndicators<T extends { IndicatorDisplayName?: string | null }>(programName: string, indicators: readonly T[], limit: number = 3): T[] {
    const wanted = nameTokens(programName);
    if (!wanted.length) {
        return [];
    }
    const contains = (outer: readonly string[], inner: readonly string[]): boolean => inner.length > 0 && (inner.length > 1 || inner[0].length >= 5) && inner.every((word) => outer.includes(word));
    return indicators
        .filter((indicator) => {
            const words = nameTokens(indicator.IndicatorDisplayName ?? "");
            return contains(words, wanted) || contains(wanted, words);
        })
        .slice(0, limit);
}

const byText = (a: string, b: string): number => a.localeCompare(b, "en");

function scheduledSourceKind(location: string | null | undefined): string {
    if (!location) {
        return "Entered by hand";
    }
    return /\/rest\/services\//i.test(location) ? "Map service" : "Partner API";
}

/**
 * The register: LT Info's programs and indicators joined to the planned charts by program ID. The
 * planned programs keep LT Info's IDs for the programs LT Info has, so the ID is the join.
 */
export function buildRegister(ltInfoPrograms: readonly MonitoringNewProgramGridRow[], dataModel: MonitoringNewDataModel, planned: PlannedSources): Register {
    const ltInfoByID = new Map(ltInfoPrograms.map((program) => [program.MonitoringProgramID, program]));
    const plannedByID = new Map(planned.Programs.map((program) => [program.MonitoringProgramID, program]));
    const indicators = dataModel.Indicators ?? [];
    const dataSources = dataModel.DataSources ?? [];

    const indicatorsByProgramID = new Map<number, MonitoringNewIndicatorSource[]>();
    for (const indicator of indicators) {
        for (const programID of indicator.MonitoringProgramIDs ?? []) {
            indicatorsByProgramID.set(programID, [...(indicatorsByProgramID.get(programID) ?? []), indicator]);
        }
    }

    const plannedCharts = planned.Uses.filter((use) => use.Kind === "chart");
    const chartsByProgramID = new Map<number, PlannedUse[]>();
    for (const chart of plannedCharts) {
        chartsByProgramID.set(chart.MonitoringProgramID, [...(chartsByProgramID.get(chart.MonitoringProgramID) ?? []), chart]);
    }

    const sourceByKey = new Map(buildLineage(planned.Uses).map((source) => [source.key, source]));
    const programName = (programID: number): string => ltInfoByID.get(programID)?.MonitoringProgramName ?? plannedByID.get(programID)?.MonitoringProgramName ?? `Program ${programID}`;
    const categoryName = (programID: number): string => plannedByID.get(programID)?.CategoryName ?? ltInfoByID.get(programID)?.MonitoringProgramCategoryDisplayName ?? "";
    const names = (list: readonly MonitoringNewIndicatorSource[]): string => list.map((indicator) => indicator.IndicatorDisplayName).join("; ");

    // ---------- One row per planned chart ----------
    const charts: ChartRow[] = plannedCharts.map((chart) => {
        const source = sourceByKey.get(chart.Source)!;
        const linked = indicatorsByProgramID.get(chart.MonitoringProgramID) ?? [];
        const inLtInfo = ltInfoByID.has(chart.MonitoringProgramID);
        const nextStep = chartNextStep({ inLtInfo, indicatorCount: linked.length, onService: chart.SourceKind === "service" });
        return {
            MonitoringProgramID: chart.MonitoringProgramID,
            ProgramLinkID: inLtInfo ? chart.MonitoringProgramID : null,
            ProgramName: programName(chart.MonitoringProgramID),
            InLtInfo: inLtInfo,
            CategoryName: categoryName(chart.MonitoringProgramID),
            Title: chart.Title,
            SourceName: source.name,
            SourceKindLabel: chart.SourceKind === "service" ? "Map service" : "Data file",
            Layer: chart.Layer,
            LayerHref: chart.SourceKind === "service" ? layerHref(source, chart.Layer) : "",
            PathLabel: pathById(classify(source, chart.Layer)).label,
            Fields: chart.Fields.join(", "),
            Where: chart.Where,
            Upstream: chart.Upstream,
            IndicatorCount: linked.length,
            IndicatorNames: names(linked),
            NextStep: nextStep,
            NextStepLabel: NEXT_STEP_LABELS[nextStep],
        };
    });

    // ---------- One row per program: LT Info's, then the planned ones LT Info does not have ----------
    const programIDs = [...new Set([...ltInfoByID.keys(), ...plannedByID.keys()])];
    const programs: ProgramRow[] = programIDs
        .map((programID) => {
            const ltInfo = ltInfoByID.get(programID);
            const plannedProgram = plannedByID.get(programID);
            const linked = indicatorsByProgramID.get(programID) ?? [];
            const programCharts = chartsByProgramID.get(programID) ?? [];
            const chartsOnFiles = programCharts.filter((chart) => chart.SourceKind === "file").length;
            const name = programName(programID);
            const linkedIDs = new Set(linked.map((indicator) => indicator.IndicatorID));
            const unlinked = indicators.filter((indicator) => !linkedIDs.has(indicator.IndicatorID));
            const suggested = [...suggestIndicators(plannedProgram?.MonitoringProgramName ?? name, unlinked), ...(plannedProgram && ltInfo ? suggestIndicators(name, unlinked) : [])];
            const nextStep = programNextStep({ inLtInfo: !!ltInfo, indicatorCount: linked.length, plannedCharts: programCharts.length, chartsOnFiles });
            return {
                MonitoringProgramID: programID,
                ProgramLinkID: ltInfo ? programID : null,
                ProgramName: name,
                PlannedName: ltInfo && plannedProgram && plannedProgram.MonitoringProgramName !== ltInfo.MonitoringProgramName ? plannedProgram.MonitoringProgramName : "",
                InLtInfo: !!ltInfo,
                CategoryName: categoryName(programID),
                IndicatorCount: linked.length,
                IndicatorNames: names(linked),
                SuggestedIndicators: names([...new Set(suggested)].slice(0, 3)),
                PlannedCharts: programCharts.length,
                ChartsOnServices: programCharts.length - chartsOnFiles,
                ChartsOnFiles: chartsOnFiles,
                ScheduledSources: dataSources.filter((source) => source.MonitoringProgramID === programID).length,
                NextStep: nextStep,
                NextStepLabel: NEXT_STEP_LABELS[nextStep],
            };
        })
        .sort((a, b) => byText(a.ProgramName, b.ProgramName));

    // ---------- One row per active indicator ----------
    const indicatorRows: IndicatorRow[] = indicators.map((indicator) => {
        const today = indicatorToday(indicator);
        const programIDsOfIndicator = indicator.MonitoringProgramIDs ?? [];
        const dashboards = [
            indicator.IsReportedInThresholdDashboard ? "Threshold" : "",
            indicator.IsReportedInClimateResilienceDashboard ? "Climate Resilience" : "",
            indicator.IsReportedInLakeClarity ? "Lake Clarity" : "",
            indicator.IsReportedInTransportationTracker ? "Transportation" : "",
        ].filter(Boolean);
        return {
            IndicatorID: indicator.IndicatorID,
            IndicatorDisplayName: indicator.IndicatorDisplayName,
            IndicatorTypeDisplayName: indicator.IndicatorTypeDisplayName,
            MeasurementUnitTypeDisplayName: indicator.MeasurementUnitTypeDisplayName ?? "",
            DataSourceType: indicator.IndicatorDataSourceTypeDisplayName,
            Today: today,
            TodayLabel: TODAY_LABELS[today],
            ReportedValueCount: indicator.ReportedValueCount,
            ChartSourceURL: indicator.ChartSourceURL ?? "",
            ProgramCount: programIDsOfIndicator.length,
            ProgramNames: programIDsOfIndicator.map(programName).join("; "),
            PlannedCharts: programIDsOfIndicator.reduce((sum, programID) => sum + (chartsByProgramID.get(programID)?.length ?? 0), 0),
            Dashboards: dashboards.join(", "),
        };
    });

    // ---------- One row per source LT Info reads on a schedule ----------
    const scheduledSources: ScheduledSourceRow[] = dataSources.map((source: MonitoringNewDataSourceSimple) => ({
        MonitoringDataSourceID: source.MonitoringDataSourceID,
        MonitoringDataSourceName: source.MonitoringDataSourceName,
        Kind: scheduledSourceKind(source.MonitoringDataSourceLocation),
        MonitoringDataSourceLocation: source.MonitoringDataSourceLocation ?? "",
        MonitoringProgramID: source.MonitoringProgramID ?? null,
        ProgramName: source.MonitoringProgramID != null ? programName(source.MonitoringProgramID) : "",
        LastRunDate: source.LastRunDate ?? null,
        LastRunStatus: source.LastRunStatus ?? "",
        LastChangeDate: source.LastChangeDate ?? null,
    }));

    const linkedRows = indicatorRows.filter((indicator) => indicator.ProgramCount > 0);
    const totals: RegisterTotals = {
        programs: ltInfoPrograms.length,
        programsWithIndicator: ltInfoPrograms.filter((program) => (indicatorsByProgramID.get(program.MonitoringProgramID)?.length ?? 0) > 0).length,
        programsToAdd: programs.filter((program) => !program.InLtInfo).length,
        linkedIndicators: linkedRows.length,
        linkedStored: linkedRows.filter((indicator) => indicator.Today === "stored").length,
        linkedEmbedded: linkedRows.filter((indicator) => indicator.Today === "embedded").length,
        linkedNoData: linkedRows.filter((indicator) => indicator.Today === "none").length,
        plannedCharts: charts.length,
        chartsOnServices: charts.filter((chart) => chart.SourceKindLabel === "Map service").length,
        chartsOnFiles: charts.filter((chart) => chart.SourceKindLabel === "Data file").length,
        chartsReadyToBind: charts.filter((chart) => chart.NextStep === "bind").length,
        scheduledSources: scheduledSources.filter((source) => source.Kind !== "Entered by hand").length,
        scheduledMapServiceLayers: scheduledSources.filter((source) => source.Kind === "Map service").length,
        boundIndicators: 0,
    };

    return { charts, programs, indicators: indicatorRows, scheduledSources, totals };
}

/** How many layers (or files) and planned uses come in by each path, keyed by path ID. */
export function pathCounts(planned: PlannedSources): Record<string, { sources: number; uses: number }> {
    const counts: Record<string, { sources: number; uses: number }> = {};
    for (const source of buildLineage(planned.Uses)) {
        for (const layer of source.layers) {
            const id = classify(source, layer.layer);
            counts[id] ??= { sources: 0, uses: 0 };
            counts[id].sources += 1;
            counts[id].uses += layer.uses.length;
        }
    }
    return counts;
}
