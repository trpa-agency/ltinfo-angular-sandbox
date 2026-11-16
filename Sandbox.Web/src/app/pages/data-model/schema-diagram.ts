import { Component } from "@angular/core";

type Key = "PK" | "FK";

interface Field {
    name: string;
    key?: Key;
}

interface Entity {
    id: string;
    name: string;
    x: number;
    y: number;
    fields: Field[];
    /** Drawn dashed: a table this page proposes, not one LT Info has. */
    proposed?: boolean;
}

/** Something outside the database that rows are read from. */
interface Endpoint {
    label: string;
    x: number;
    y: number;
}

/** A relationship line. Each path is drawn by hand so lines never cross a table. */
interface Link {
    d: string;
    start?: "one";
    end?: "many" | "arrow";
    /** Dashed: a proposed relationship, or a flow of data that is not a foreign key. */
    dashed?: boolean;
    label: string;
}

const W = 270;
const HEAD = 34;
const ROW = 22;
const PAD = 6;
const ENDPOINT_H = 40;
const COL = [16, 366, 716];

const height = (entity: Entity): number => HEAD + entity.fields.length * ROW + PAD;
/** The vertical middle of a field row. */
const rowY = (entity: Entity, index: number): number => entity.y + HEAD + PAD / 2 + index * ROW + ROW / 2;

// Left: what LT Info ingests on a schedule today. Middle: the indicator, which is the unit of
// record. Right: the two tables this page proposes. IndicatorDataSource ties an indicator to the
// map service layer its numbers are read from, or, for the data LT Info collects itself, to a
// native reader by NativeSourceID; MonitoringProgramLayer ties a program to the layers its site
// list, map and overlays are read from. The values themselves stay where they are collected.
// Update the lists when a table script in LtInfo.Database/dbo/Tables changes.
const ENTITIES: Entity[] = [
    {
        id: "program",
        name: "MonitoringProgram",
        x: COL[0],
        y: 20,
        fields: [{ name: "MonitoringProgramID", key: "PK" }, { name: "MonitoringProgramName" }, { name: "MonitoringProgramCategoryID", key: "FK" }, { name: "MonitoringProgramTypeID", key: "FK" }],
    },
    {
        id: "site",
        name: "MonitoringSite",
        x: COL[0],
        y: 180,
        fields: [{ name: "MonitoringSiteID", key: "PK" }, { name: "MonitoringProgramID", key: "FK" }, { name: "MonitoringSiteName" }, { name: "MonitoringSiteLocation" }],
    },
    {
        id: "station-observation",
        name: "MonitoringStationObservation",
        x: COL[0],
        y: 340,
        fields: [
            { name: "MonitoringStationObservationID", key: "PK" },
            { name: "MonitoringStationID", key: "FK" },
            { name: "ObservationDate" },
            { name: "ObservationValue" },
            { name: "MonitoringRawDataBatchID", key: "FK" },
        ],
    },
    {
        id: "monitoring-data-source",
        name: "MonitoringDataSource",
        x: COL[0],
        y: 522,
        fields: [{ name: "MonitoringDataSourceID", key: "PK" }, { name: "MonitoringDataSourceName" }, { name: "MonitoringDataSourceLocation" }, { name: "DataQuery" }],
    },
    {
        id: "indicator-program",
        name: "IndicatorMonitoringProgram",
        x: COL[1],
        y: 20,
        fields: [{ name: "IndicatorMonitoringProgramID", key: "PK" }, { name: "IndicatorID", key: "FK" }, { name: "MonitoringProgramID", key: "FK" }],
    },
    {
        id: "indicator",
        name: "Indicator",
        x: COL[1],
        y: 180,
        fields: [
            { name: "IndicatorID", key: "PK" },
            { name: "IndicatorDisplayName" },
            { name: "MeasurementUnitTypeID", key: "FK" },
            { name: "IndicatorTypeID", key: "FK" },
            { name: "IndicatorDataSourceTypeID", key: "FK" },
            { name: "ChartSourceURL" },
        ],
    },
    {
        id: "reported-value",
        name: "IndicatorReportedValue",
        x: COL[1],
        y: 384,
        fields: [{ name: "IndicatorReportedValueID", key: "PK" }, { name: "IndicatorID", key: "FK" }, { name: "IndicatorReportingPeriodID", key: "FK" }, { name: "ReportedValue" }],
    },
    {
        id: "indicator-data-source",
        name: "IndicatorDataSource",
        x: COL[2],
        y: 20,
        proposed: true,
        fields: [
            { name: "IndicatorDataSourceID", key: "PK" },
            { name: "IndicatorID", key: "FK" },
            { name: "IngestPathID", key: "FK" },
            { name: "SourceOrganizationID", key: "FK" },
            { name: "NativeSourceID" },
            { name: "ServiceUrl" },
            { name: "LayerID" },
            { name: "WhereClause" },
            { name: "AxisField" },
            { name: "ValueFields" },
            { name: "Statistic" },
            { name: "SeriesField" },
            { name: "PickField" },
            { name: "StandardField" },
            { name: "SiteField" },
            { name: "ChartSettings" },
            { name: "UpdateFrequency" },
        ],
    },
    {
        id: "program-layer",
        name: "MonitoringProgramLayer",
        x: COL[2],
        y: 454,
        proposed: true,
        fields: [
            { name: "MonitoringProgramLayerID", key: "PK" },
            { name: "MonitoringProgramID", key: "FK" },
            { name: "LayerUseTypeID", key: "FK" },
            { name: "IngestPathID", key: "FK" },
            { name: "SourceOrganizationID", key: "FK" },
            { name: "ServiceUrl" },
            { name: "LayerID" },
            { name: "WhereClause" },
            { name: "NameField" },
            { name: "YearField" },
            { name: "GroupField" },
            { name: "LayerSettings" },
            { name: "UpdateFrequency" },
        ],
    },
];

/** The canvas: wide enough for three columns, tall enough for the last row of endpoints. */
const VIEW_WIDTH = 1000;
const VIEW_HEIGHT = 974;

const byID = (id: string): Entity => ENTITIES.find((entity) => entity.id === id)!;

const ENDPOINTS: Endpoint[] = [
    { label: "LTInfo_Monitoring map service", x: COL[0], y: 682 },
    { label: "TRPA map service layers", x: COL[2], y: 802 },
    { label: "Partner map service layers", x: COL[2], y: 858 },
    // Last, below the end of the service line, so the native line crosses nothing on its way down.
    { label: "LT Info native readers", x: COL[2], y: 914 },
];

function buildLinks(): Link[] {
    const program = byID("program");
    const site = byID("site");
    const stationObservation = byID("station-observation");
    const monitoringDataSource = byID("monitoring-data-source");
    const indicatorProgram = byID("indicator-program");
    const indicator = byID("indicator");
    const reportedValue = byID("reported-value");
    const dataSource = byID("indicator-data-source");
    const programLayer = byID("program-layer");

    const right = (entity: Entity): number => entity.x + W;
    const middle = (entity: Entity): number => entity.x + W / 2;
    const bottom = (entity: Entity): number => entity.y + height(entity);
    const endpointMiddle = (index: number): number => ENDPOINTS[index].y + ENDPOINT_H / 2;

    return [
        {
            label: "A program has many indicator links",
            d: `M${right(program)},${rowY(program, 0)} H326 V${rowY(indicatorProgram, 2)} H${indicatorProgram.x}`,
            start: "one",
            end: "many",
        },
        {
            label: "An indicator has many program links",
            d: `M${middle(indicator)},${indicator.y} V${bottom(indicatorProgram)}`,
            start: "one",
            end: "many",
        },
        {
            label: "A program has many sites",
            d: `M${middle(program)},${bottom(program)} V${site.y}`,
            start: "one",
            end: "many",
        },
        {
            label: "A site has stations, and a station has many observations",
            d: `M${middle(site)},${bottom(site)} V${stationObservation.y}`,
            start: "one",
            end: "many",
        },
        {
            label: "The nightly job turns a data source's records into sites and observations",
            d: `M${middle(monitoringDataSource)},${monitoringDataSource.y} V${bottom(stationObservation)}`,
            end: "arrow",
            dashed: true,
        },
        {
            label: "A data source reads a layer of the LTInfo_Monitoring map service",
            d: `M${middle(monitoringDataSource)},${bottom(monitoringDataSource)} V${ENDPOINTS[0].y}`,
            end: "arrow",
            dashed: true,
        },
        {
            label: "An indicator has many reported values",
            d: `M${middle(indicator)},${bottom(indicator)} V${reportedValue.y}`,
            start: "one",
            end: "many",
        },
        {
            label: "Proposed: an indicator has a data source that names its map service layer",
            d: `M${right(indicator)},${rowY(indicator, 0)} H686 V${rowY(dataSource, 1)} H${dataSource.x}`,
            start: "one",
            end: "many",
            dashed: true,
        },
        {
            // From the program's key, down the first gutter, under the middle column, then up the
            // second gutter: no table and no other line is crossed.
            label: "Proposed: a program has many layers, for its site list, its map and its overlays",
            d: `M${right(program)},${rowY(program, 0)} H306 V${bottom(reportedValue) + 40} H666 V${rowY(programLayer, 1)} H${programLayer.x}`,
            start: "one",
            end: "many",
            dashed: true,
        },
        {
            label: "Proposed: a program page reads the TRPA map service layer a data source or a program layer names",
            d: `M${right(dataSource)},${rowY(dataSource, 5)} H994 V${endpointMiddle(1)} H${ENDPOINTS[1].x + W}`,
            end: "arrow",
            dashed: true,
        },
        {
            label: "Proposed: a program page reads the partner map service layer a data source or a program layer names",
            d: `M${right(dataSource)},${rowY(dataSource, 5)} H994 V${endpointMiddle(2)} H${ENDPOINTS[2].x + W}`,
            end: "arrow",
            dashed: true,
        },
        {
            // NativeSourceID sits above ServiceUrl, so this line leaves the table above where the
            // service line starts and runs down the outer edge, past the service endpoints.
            label: "Proposed: a program page reads the LT Info native reader a data source names, for transit ridership and stormwater",
            d: `M${right(dataSource)},${rowY(dataSource, 4)} H998 V${endpointMiddle(3)} H${ENDPOINTS[3].x + W}`,
            end: "arrow",
            dashed: true,
        },
        {
            // Joins the line above on its way down to the two services.
            label: "Proposed: a program layer names its map service layer",
            d: `M${right(programLayer)},${rowY(programLayer, 5)} H994`,
            dashed: true,
        },
    ];
}

/**
 * The tables behind the Data Model page: what LT Info has today on the left and in the middle, and
 * on the right the two proposed tables that tie an indicator, and a program, to map service layers.
 * Inline SVG built from the lists above; no shared component draws an entity diagram.
 */
@Component({
    selector: "app-schema-diagram",
    styleUrl: "./schema-diagram.scss",
    template: `
        <div class="erd" tabindex="0" role="region" aria-label="Table diagram, scrolls sideways on a narrow screen">
            <svg class="erd__svg" [attr.viewBox]="viewBox" role="img" aria-labelledby="monitoring-new-erd-title monitoring-new-erd-desc">
                <title id="monitoring-new-erd-title">LT Info tables for monitoring programs and indicators, with two proposed tables</title>
                <desc id="monitoring-new-erd-desc">{{ description }}</desc>
                <defs>
                    <marker id="monitoring-new-erd-one" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
                        <path d="M3,1 V11" class="erd__mark" />
                    </marker>
                    <marker id="monitoring-new-erd-many" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" orient="auto">
                        <path d="M13,1 L3,7 L13,13 M3,7 H13 M1,1 V13" class="erd__mark" />
                    </marker>
                    <marker id="monitoring-new-erd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto">
                        <path d="M1,1 L9,5 L1,9" class="erd__mark" />
                    </marker>
                </defs>

                @for (link of links; track link.label) {
                    <path
                        class="erd__link"
                        [class.erd__link--dashed]="link.dashed"
                        [attr.d]="link.d"
                        [attr.marker-start]="link.start ? 'url(#monitoring-new-erd-one)' : null"
                        [attr.marker-end]="link.end ? 'url(#monitoring-new-erd-' + link.end + ')' : null">
                        <title>{{ link.label }}</title>
                    </path>
                }

                @for (entity of entities; track entity.id) {
                    <g class="erd__entity" [class.erd__entity--proposed]="entity.proposed" [attr.data-entity]="entity.id">
                        <rect class="erd__card" [attr.x]="entity.x" [attr.y]="entity.y" [attr.width]="width" [attr.height]="entityHeight(entity)" rx="6" />
                        <path class="erd__head" [attr.d]="headPath(entity)" />
                        <line class="erd__rule" [attr.x1]="entity.x" [attr.x2]="entity.x + width" [attr.y1]="entity.y + head" [attr.y2]="entity.y + head" />
                        <text class="erd__name" [attr.x]="entity.x + 12" [attr.y]="entity.y + 22">{{ entity.name }}</text>
                        @if (entity.proposed) {
                            <text class="erd__flag" [attr.x]="entity.x + width - 12" [attr.y]="entity.y + 22" text-anchor="end">Proposed</text>
                        }
                        @for (field of entity.fields; track field.name; let i = $index) {
                            <text class="erd__field" [attr.x]="entity.x + 12" [attr.y]="fieldY(entity, i) + 4">{{ field.name }}</text>
                            @if (field.key) {
                                <text class="erd__key" [attr.data-key]="field.key" [attr.x]="entity.x + width - 12" [attr.y]="fieldY(entity, i) + 4" text-anchor="end">{{ field.key }}</text>
                            }
                        }
                    </g>
                }

                @for (endpoint of endpoints; track endpoint.label) {
                    <g class="erd__endpoint">
                        <rect [attr.x]="endpoint.x" [attr.y]="endpoint.y" [attr.width]="width" [attr.height]="endpointHeight" rx="20" />
                        <text [attr.x]="endpoint.x + width / 2" [attr.y]="endpoint.y + 25" text-anchor="middle">{{ endpoint.label }}</text>
                    </g>
                }
            </svg>
        </div>
        <ul class="erd-key" aria-label="Diagram key">
            <li><span class="erd-key__tag" data-key="PK">PK</span> Primary key</li>
            <li><span class="erd-key__tag" data-key="FK">FK</span> Foreign key</li>
            <li><span class="erd-key__box"></span> In LT Info today</li>
            <li><span class="erd-key__box erd-key__box--proposed"></span> Proposed table</li>
            <li>
                <svg class="erd-key__line" viewBox="0 0 40 14" aria-hidden="true"><path d="M2,7 H38 M30,1 L38,7 L30,13 M38,1 V13" /></svg>
                One to many
            </li>
            <li>
                <svg class="erd-key__line erd-key__line--dashed" viewBox="0 0 40 14" aria-hidden="true"><path d="M2,7 H36 M30,2 L37,7 L30,12" /></svg>
                Proposed, or data read from a service
            </li>
        </ul>
    `,
})
export class SchemaDiagram {
    public readonly entities = ENTITIES;
    public readonly endpoints = ENDPOINTS;
    public readonly links = buildLinks();
    public readonly viewBox = `0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`;
    public readonly width = W;
    public readonly head = HEAD;
    public readonly endpointHeight = ENDPOINT_H;
    public readonly description = this.links.map((link) => link.label).join(". ");

    public entityHeight(entity: Entity): number {
        return height(entity);
    }

    public fieldY(entity: Entity, index: number): number {
        return rowY(entity, index);
    }

    /** The header band: the card's top corners rounded, square at the rule. */
    public headPath(entity: Entity): string {
        const r = 6;
        return `M${entity.x},${entity.y + HEAD} V${entity.y + r} Q${entity.x},${entity.y} ${entity.x + r},${entity.y} H${entity.x + W - r} Q${entity.x + W},${entity.y} ${entity.x + W},${entity.y + r} V${entity.y + HEAD} Z`;
    }
}
