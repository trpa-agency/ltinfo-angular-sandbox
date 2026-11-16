// Where each planned chart, map and site list reads its data: the planned uses grouped by source
// (a map service or a data file) and layer. Pure logic, no DOM and no Angular, so the Playwright
// "unit" project can run it in Node.
//
// The planned uses come from src/assets/monitoring-new/planned-sources.json, written by
// tools/gen-monitoring-new-planned-sources.mjs from the design sandbox's settings. That file is a
// stand-in until LT Info stores the chart and map settings itself.

/** What a program page does with the rows it reads. */
export type UseKind = "chart" | "map" | "sites" | "sites-per-year" | "overlay" | "profile";

export const USE_LABELS: Record<UseKind, string> = {
    chart: "Chart",
    map: "Map",
    sites: "Site list",
    "sites-per-year": "Sites per year",
    overlay: "Map overlay",
    profile: "Site profile",
};

/** A map service on an ArcGIS Server, or a file the app would serve. */
export type SourceKind = "service" | "file";

/** One chart, map or list planned for one program page, with the source it reads. */
export interface PlannedUse {
    MonitoringProgramID: number;
    Kind: UseKind;
    /** The chart or map title; for a list, what a site is called. */
    Title: string;
    /** The fields the page reads, in the order the settings name them. */
    Fields: string[];
    /** Fields the page makes itself (an unpivoted x and y), so the source does not hold them. */
    VirtualFields: string[];
    /** The value columns a chart or a site's record draws; empty for a layer use and for a reshaped chart. */
    ValueFields: string[];
    /** The where clause, when the settings filter the layer. */
    Where: string;
    /** The statistic the page asks the service for (sum, avg, count), when it asks for one. */
    Statistic: string;
    /** For a file: where its numbers came from, when the settings say. */
    Upstream: string;
    /** The service address or the file path, exactly as the settings give it. */
    Source: string;
    SourceKind: SourceKind;
    /** The layer or table ID in the service; null for a file, or when the settings name none. */
    Layer: number | null;
}

/** A program as the redesign plans it. Some are not in LT Info yet. */
export interface PlannedProgram {
    MonitoringProgramID: number;
    MonitoringProgramName: string;
    CategoryName: string;
}

/** The planned-sources.json file. */
export interface PlannedSources {
    Programs: PlannedProgram[];
    Uses: PlannedUse[];
}

/** A layer of a service, or a file, and every use of it. */
export interface SourceLayer {
    /** "<source key>|<layer>" for a service layer, the source key for a file. */
    key: string;
    layer: number | null;
    uses: PlannedUse[];
}

export interface DataSource {
    /** The service address or the file path. */
    key: string;
    kind: SourceKind;
    /** "Vegetation" for a service, "seral-stage-by-zone.json" for a file. */
    name: string;
    /** "MapServer", "FeatureServer", "JSON file", "CSV file" or "GeoJSON file". */
    type: string;
    /** The server the service is on, such as "maps.trpa.org"; empty for a file. */
    host: string;
    layers: SourceLayer[];
    /** Every use across its layers. */
    useCount: number;
    programIDs: number[];
}

const SERVICE_PATTERN = /\/services\/((?:[^/]+\/)*[^/]+)\/(MapServer|FeatureServer)\/?$/;

/** "Vegetation" and "MapServer" from a service address; folders stay in the name. */
export function parseService(url: string): { name: string; type: string } {
    const match = SERVICE_PATTERN.exec(url);
    return match ? { name: match[1], type: match[2] } : { name: url, type: "Service" };
}

/** "maps.trpa.org" from a service address; empty when it is not an address. */
export function hostOf(url: string): string {
    const match = /^https?:\/\/([^/]+)/i.exec(url);
    return match ? match[1].toLowerCase() : "";
}

function fileType(path: string): string {
    if (/\.geojson(\?|$)/i.test(path)) {
        return "GeoJSON file";
    }
    if (/\.csv(\?|$)/i.test(path)) {
        return "CSV file";
    }
    return "JSON file";
}

function fileName(path: string): string {
    return decodeURIComponent(path.split("?")[0].split("/").pop() || path);
}

/**
 * Every source the planned uses read, most used first, each with its layers in ID order and the
 * uses of each layer in the order given. A use whose settings name no layer still lists.
 */
export function buildLineage(uses: readonly PlannedUse[]): DataSource[] {
    const sources = new Map<string, DataSource>();
    for (const use of uses) {
        let source = sources.get(use.Source);
        if (!source) {
            const named = use.SourceKind === "file" ? { name: fileName(use.Source), type: fileType(use.Source) } : parseService(use.Source);
            source = { key: use.Source, kind: use.SourceKind, ...named, host: use.SourceKind === "file" ? "" : hostOf(use.Source), layers: [], useCount: 0, programIDs: [] };
            sources.set(use.Source, source);
        }
        const layerKey = use.SourceKind === "file" ? use.Source : `${use.Source}|${use.Layer}`;
        let layer = source.layers.find((item) => item.key === layerKey);
        if (!layer) {
            layer = { key: layerKey, layer: use.Layer, uses: [] };
            source.layers.push(layer);
        }
        layer.uses.push(use);
        source.useCount += 1;
        if (!source.programIDs.includes(use.MonitoringProgramID)) {
            source.programIDs.push(use.MonitoringProgramID);
        }
    }

    const list = [...sources.values()];
    for (const source of list) {
        source.layers.sort((a, b) => (a.layer ?? -1) - (b.layer ?? -1));
    }
    // Two services can share a name (Vegetation MapServer and FeatureServer); say which is which.
    const nameCounts = new Map<string, number>();
    for (const source of list) {
        nameCounts.set(source.name, (nameCounts.get(source.name) ?? 0) + 1);
    }
    for (const source of list) {
        if ((nameCounts.get(source.name) ?? 0) > 1) {
            source.name = `${source.name} (${source.type})`;
        }
    }
    return list.sort((a, b) => b.useCount - a.useCount || a.name.localeCompare(b.name, "en"));
}

/** The service directory page of a layer, which also answers ?f=json; for a file, the file. */
export function layerHref(source: Pick<DataSource, "key" | "kind">, layer: number | null): string {
    return source.kind === "service" && layer !== null ? `${source.key}/${layer}` : source.key;
}
