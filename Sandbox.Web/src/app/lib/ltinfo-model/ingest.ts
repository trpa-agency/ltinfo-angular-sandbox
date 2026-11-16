// The ways data reaches the Monitoring Dashboard, what each way must meet before a chart may read
// it, and the checks the app can run itself against a live map service.
//
// The rule the paths serve: every chart is an indicator in LT Info, linked to its monitoring
// program, and the indicator's numbers are read live from a map service layer, TRPA's or a
// partner's. LT Info stores where to read them, not a copy. Two kinds of data are the exception,
// because LT Info is where they are collected: transit ridership and the stormwater tools' load
// reductions. Those are read live from LT Info itself, through a named reader. A path
// has acceptance criteria of two kinds: checks this module (or the register) runs, and conditions a
// person confirms. The wording is a draft for TRPA to edit; the checks are code.
//
// Pure apart from the fetch function passed in, so the Playwright "unit" project can run it in Node.

import type { DataSource, PlannedUse, SourceLayer } from "./lineage";
import { layerHref } from "./lineage";

export type PathId = "trpa-service" | "partner-pipeline" | "partner-service" | "ltinfo-native" | "file" | "ltinfo";

/** The automated checks, by ID. A criterion names the check that proves it. */
export type CheckId = "indicator" | "answers" | "layer-exists" | "described" | "fields" | "records" | "cited";

export interface Criterion {
    text: string;
    /** The automated check that covers it; absent when a person confirms it. */
    check?: CheckId;
}

export interface IngestPath {
    id: PathId;
    label: string;
    /** Who holds the data and how it gets here, in one sentence. */
    summary: string;
    steward: string;
    /**
     * Whether a new indicator may take its numbers this way: "yes" for a map service, "native" for
     * the data LT Info collects itself and nothing else, "interim" for a path to move off, "no" for a
     * path that carries program records, not measurements.
     */
    forIndicators: "yes" | "native" | "interim" | "no";
    criteria: Criterion[];
}

const INDICATOR: Criterion = { text: "An active indicator exists in LT Info and is linked to the monitoring program.", check: "indicator" };
const ANSWERS: Criterion = { text: "The service answers a request from the browser.", check: "answers" };
const LAYER_EXISTS: Criterion = { text: "The layer or table named in the settings exists.", check: "layer-exists" };
const FIELDS: Criterion = { text: "Every field the chart or map reads exists in the layer.", check: "fields" };
const RECORDS: Criterion = { text: "The filter returns at least one record.", check: "records" };
const DESCRIBED: Criterion = { text: "The layer has a description in the service directory.", check: "described" };
const UNITS: Criterion = { text: "The indicator's unit of measure matches the value field's unit." };

/** The six paths, in the order the page lists them. */
export const INGEST_PATHS: readonly IngestPath[] = [
    {
        id: "trpa-service",
        label: "TRPA Map Service",
        summary: "Data TRPA collects or maintains, published from the enterprise geodatabase as a service on maps.trpa.org.",
        steward: "TRPA program lead",
        forIndicators: "yes",
        criteria: [
            INDICATOR,
            ANSWERS,
            LAYER_EXISTS,
            FIELDS,
            RECORDS,
            DESCRIBED,
            UNITS,
            { text: "A TRPA data steward is named for the layer." },
            { text: "The update schedule is written down, and the latest update is inside it." },
            { text: "Field names and units are documented in a data dictionary." },
        ],
    },
    {
        id: "partner-pipeline",
        label: "Partner Data, TRPA Pipeline",
        summary: "Data a partner agency owns, pulled by a TRPA pipeline, stored at TRPA, and published as a service on maps.trpa.org.",
        steward: "Partner agency data steward, with a TRPA pipeline owner",
        forIndicators: "yes",
        criteria: [
            INDICATOR,
            ANSWERS,
            LAYER_EXISTS,
            FIELDS,
            RECORDS,
            DESCRIBED,
            UNITS,
            { text: "The partner agency and its data steward are named, with the address the data is pulled from." },
            { text: "The pipeline is a script in a TRPA repository with a config file, logging, and no secrets in code." },
            { text: "Each run compares record counts and value ranges against the partner source and logs the result." },
            { text: "The refresh schedule is set, and a failed run alerts the pipeline owner." },
            { text: "The partner steward has reviewed the published layer once." },
        ],
    },
    {
        id: "partner-service",
        label: "Partner Map Service",
        summary: "Data read from a partner agency's own map service. The partner publishes it; LT Info only reads it.",
        steward: "Partner agency data steward",
        forIndicators: "yes",
        criteria: [
            INDICATOR,
            ANSWERS,
            LAYER_EXISTS,
            FIELDS,
            RECORDS,
            UNITS,
            { text: "The partner data steward is named and has agreed to the use." },
            { text: "The service is public, needs no sign-in, and allows requests from laketahoeinfo.org." },
            { text: "The partner gives notice before a field or layer changes." },
            { text: "Null rates and value ranges were reviewed before the first chart was built." },
            { text: "The program page shows a plain message when the service does not answer." },
        ],
    },
    {
        id: "ltinfo-native",
        label: "LT Info Native Data",
        summary:
            "Measurements LT Info collects itself: transit ridership that operators report each month, and the load reductions in the stormwater tools. LT Info is their system of record, so a page reads them live from LT Info, not from a map service.",
        steward: "TRPA lead for the LT Info tool that collects the data",
        forIndicators: "native",
        criteria: [
            INDICATOR,
            UNITS,
            { text: "The data is collected in an LT Info tool, by signed-in users with that tool's role, and the tool records who entered it and when." },
            { text: "The row names one of the readers listed here, not an address. A new reader is API code, added in an LT Info release." },
            { text: "The reader is a public route that needs no sign-in, returns rows in the same shape as a map service query, and leaves out entry detail. The API tests cover it." },
            { text: "The reader returns submitted or approved values only, never drafts." },
            { text: "The reporting schedule is written down, and the tool's lead can see who has not reported." },
            { text: "Data entered in LT Info only so that a chart can read it does not qualify. It goes to a map service." },
        ],
    },
    {
        id: "file",
        label: "Extracted File",
        summary: "Numbers copied once from a published report or page into a file. An interim path: a new indicator waits until a service publishes its data.",
        steward: "TRPA analyst who made the file",
        forIndicators: "interim",
        criteria: [
            INDICATOR,
            { text: "The chart or map cites the original source.", check: "cited" },
            { text: "The script that made the file is in a TRPA repository, so the file can be rebuilt." },
            { text: "The original publication date is recorded." },
            { text: "A map service is planned to replace the file, with an owner and a date." },
        ],
    },
    {
        id: "ltinfo",
        label: "LT Info Entered Data",
        summary: "Programs, partners, photos, documents and indicator definitions that staff enter in LT Info. It describes what is monitored. Apart from the native data above, it does not carry the measurements.",
        steward: "LT Info program editor",
        forIndicators: "no",
        criteria: [
            { text: "The record is entered by a signed-in user with the editor role." },
            { text: "A program has a name, category, description and monitoring approach." },
            { text: "An indicator has a definition, a unit of measure and at least one monitoring program." },
            { text: "The program lead has reviewed the page once after entry." },
        ],
    },
];

export const pathById = (id: PathId): IngestPath => INGEST_PATHS.find((path) => path.id === id)!;

/** A TRPA-hosted service, or some of its layers, that holds a partner agency's data. */
export interface PartnerPipeline {
    /** The service name as the page lists it, such as Transportation_SMART. */
    service: string;
    /** The layer and table IDs the partner's data is in, or "all" for the whole service. */
    layers: number[] | "all";
    /** The agency that owns the data. */
    partner: string;
    /** Where the data is pulled from. */
    pulledFrom: string;
    /** The TRPA script that loads it, and its address in a TRPA repository. */
    script: string;
    scriptHref: string;
}

/**
 * The partner data TRPA pulls, stores and publishes. An address cannot tell TRPA data from partner
 * data, so this list is how a layer gets the Partner Data, TRPA Pipeline path; a maps.trpa.org
 * layer that is not listed counts as a TRPA map service.
 */
export const PARTNER_PIPELINES: readonly PartnerPipeline[] = [
    {
        service: "Transportation_SMART",
        layers: "all",
        partner: "Tahoe Transportation District",
        pulledFrom: "Derq INSIGHT traffic camera service",
        script: "SMART_Phase1",
        scriptHref: "https://github.com/trpa-agency/Transportation/tree/main/SMART_Phase1",
    },
];

/** The pipeline a service layer comes through, if it is listed. */
export function pipelineOf(serviceName: string, layer: number | null): PartnerPipeline | undefined {
    const name = serviceName.replace(/ \((MapServer|FeatureServer)\)$/, "");
    return PARTNER_PIPELINES.find((pipeline) => pipeline.service === name && (pipeline.layers === "all" || (layer !== null && pipeline.layers.includes(layer))));
}

/**
 * A reader in the LT Info API for data LT Info collects itself. An IndicatorDataSource row on the
 * LT Info Native Data path names one by NativeSourceID instead of a service address and layer; the
 * reader returns records shaped like a map service query, so the row's axis, value and series
 * fields, and the chart engine, work the same. None is built yet.
 */
export interface NativeSource {
    /** The NativeSourceID a row names. */
    id: string;
    name: string;
    /** The LT Info tool the data is collected in, and by whom. */
    collectedIn: string;
    /** Where LT Info keeps it today. */
    storedIn: string;
    /** The route that reads it today, and who may call it. */
    readToday: string;
    /** What the planned pages read instead, which this reader replaces. */
    replaces: string;
}

export const NATIVE_SOURCES: readonly NativeSource[] = [
    {
        id: "transit-monthly-ridership",
        name: "Monthly transit ridership",
        collectedIn: "The Transit Monitoring Report, where each operator enters its ridership by month and gets a reminder email each month.",
        storedIn: "MonitoringStationObservation, under the TransitManualEntryMonthly data source.",
        readToday: "monitoring-programs/transit/monthly-ridership/{fiscalYear}, for signed-in transit reporters only.",
        replaces: "Table 131 of the LTinfo_Climate_Resilience_Dashboard map service, whose last complete month is October 2023.",
    },
    {
        id: "transit-annual-ridership",
        name: "Annual transit ridership by route",
        collectedIn: "The Transit Monitoring Report, where each operator enters its annual ridership by route.",
        storedIn: "MonitoringStationObservation, under the TransitManualEntryAnnual data source.",
        readToday: "monitoring-programs/transit/annual-ridership/{fiscalYear}, for signed-in transit reporters only.",
        replaces: "Nothing yet. No planned chart reads annual ridership by route.",
    },
    {
        id: "stormwater-load-reduction",
        name: "Stormwater load reductions by water year",
        collectedIn: "The stormwater tools, where jurisdictions declare credits for their registered BMPs each water year.",
        storedIn: "CreditDeclaration: fine sediment, nitrogen and phosphorus load reduction potential, by water year and BMP registration.",
        readToday: "No public route. The stormwater tools read it behind sign-in.",
        replaces: "The extracted file behind the Fine Sediment Load Reduction charts.",
    },
];

export const nativeSourceById = (id: string): NativeSource | undefined => NATIVE_SOURCES.find((source) => source.id === id);

/** The server TRPA publishes its own services on. */
export const TRPA_HOST = "maps.trpa.org";

/** The path a source layer or file comes in by. */
export function classify(source: Pick<DataSource, "kind" | "host" | "name">, layer: number | null): PathId {
    if (source.kind === "file") {
        return "file";
    }
    if (source.host !== TRPA_HOST) {
        return "partner-service";
    }
    return pipelineOf(source.name, layer) ? "partner-pipeline" : "trpa-service";
}

/* ---------- The automated checks ---------- */

export type CheckStatus = "pass" | "fail" | "skip";

export interface CheckResult {
    check: CheckId;
    label: string;
    status: CheckStatus;
    /** What was found: "1,204 records", "Missing: Site_Name". */
    detail: string;
}

/** The results for one layer or file: its own checks, then one list per use, in use order. */
export interface LayerReport {
    layer: CheckResult[];
    uses: CheckResult[][];
}

export const CHECK_LABELS: Record<CheckId, string> = {
    indicator: "Has an indicator",
    answers: "Service answers",
    "layer-exists": "Layer exists",
    described: "Has a description",
    fields: "Fields exist",
    records: "Returns records",
    cited: "Source cited",
};

const result = (check: CheckId, status: CheckStatus, detail: string): CheckResult => ({ check, label: CHECK_LABELS[check], status, detail });

/** A plain field name; anything else (Shape.STArea() / 4046.86) is an expression the server computes. */
const FIELD_NAME = /^[A-Za-z_]\w*$/;

/** Field names compare without case, as ArcGIS does. Expressions and fields the page makes are not checked. */
export function fieldsCheck(use: Pick<PlannedUse, "Fields" | "VirtualFields">, available: readonly string[]): CheckResult {
    const have = new Set(available.map((field) => field.toLowerCase()));
    const real = use.Fields.filter((field) => !use.VirtualFields.includes(field));
    const wanted = real.filter((field) => FIELD_NAME.test(field));
    const skipped = real.length - wanted.length;
    const note = skipped ? `, ${skipped} ${skipped === 1 ? "expression" : "expressions"} not checked` : "";
    if (!wanted.length) {
        return result("fields", "skip", skipped ? `Expressions only${note}` : "No fields named");
    }
    const missing = wanted.filter((field) => !have.has(field.toLowerCase()));
    return missing.length ? result("fields", "fail", `Missing: ${missing.join(", ")}`) : result("fields", "pass", `${wanted.length} of ${wanted.length} found${note}`);
}

export function citedCheck(use: Pick<PlannedUse, "Upstream">): CheckResult {
    return use.Upstream ? result("cited", "pass", use.Upstream) : result("cited", "fail", "No original source named");
}

const recordCount = (count: number): string => `${count.toLocaleString("en-US")} ${count === 1 ? "record" : "records"}`;

export type FetchLike = (url: string) => Promise<{ ok: boolean; json(): Promise<unknown> }>;

async function getJson<T>(fetchFn: FetchLike, url: string): Promise<T | null> {
    try {
        const response = await fetchFn(url);
        if (!response.ok) {
            return null;
        }
        const json = (await response.json()) as (T & { error?: unknown }) | null;
        return json && !json.error ? json : null;
    } catch {
        return null;
    }
}

/** A service layer: that it exists and is described, then each use's fields and record count. */
export async function checkServiceLayer(source: Pick<DataSource, "key" | "kind">, layer: SourceLayer, fetchFn: FetchLike): Promise<LayerReport> {
    if (layer.layer === null) {
        return { layer: [result("layer-exists", "fail", "The settings name no layer")], uses: layer.uses.map(() => []) };
    }
    const href = layerHref(source, layer.layer);
    const info = await getJson<{ name?: string; description?: string | null; fields?: { name: string }[] | null }>(fetchFn, `${href}?f=json`);
    if (!info?.name) {
        return { layer: [result("layer-exists", "fail", `Layer ${layer.layer} did not answer`)], uses: layer.uses.map(() => []) };
    }
    const described = (info.description ?? "").trim().length > 0;
    const fields = (info.fields ?? []).map((field) => field.name);

    // One count per distinct filter, however many charts share it.
    const counts = new Map<string, CheckResult>();
    const uses: CheckResult[][] = [];
    for (const use of layer.uses) {
        const where = use.Where || "1=1";
        if (!counts.has(where)) {
            const params = new URLSearchParams({ where, returnCountOnly: "true", f: "json" });
            const answer = await getJson<{ count?: number }>(fetchFn, `${href}/query?${params.toString()}`);
            counts.set(
                where,
                typeof answer?.count !== "number"
                    ? result("records", "fail", "The filter was refused")
                    : answer.count > 0
                      ? result("records", "pass", recordCount(answer.count))
                      : result("records", "fail", "No records match the filter")
            );
        }
        uses.push([fieldsCheck(use, fields), counts.get(where)!]);
    }
    return {
        layer: [result("layer-exists", "pass", info.name), result("described", described ? "pass" : "fail", described ? "Description present" : "No description")],
        uses,
    };
}

/** A file: only that each use cites where its numbers came from. The file itself is not in LT Info to read. */
export function checkFile(layer: SourceLayer): LayerReport {
    return { layer: [], uses: layer.uses.map((use) => [citedCheck(use)]) };
}

/**
 * Every layer of a source, one at a time (the map server refuses a burst). Calls onLayer as each
 * report lands, so the page can fill in while the rest run.
 */
export async function checkSource(source: DataSource, fetchFn: FetchLike, onLayer: (key: string, report: LayerReport) => void): Promise<void> {
    for (const layer of source.layers) {
        onLayer(layer.key, source.kind === "file" ? checkFile(layer) : await checkServiceLayer(source, layer, fetchFn));
    }
}

/** Passed and failed counts across reports; skipped checks count as neither. */
export function tally(reports: readonly LayerReport[]): { pass: number; fail: number } {
    let pass = 0;
    let fail = 0;
    for (const report of reports) {
        for (const check of [...report.layer, ...report.uses.flat()]) {
            if (check.status === "pass") {
                pass += 1;
            } else if (check.status === "fail") {
                fail += 1;
            }
        }
    }
    return { pass, fail };
}
