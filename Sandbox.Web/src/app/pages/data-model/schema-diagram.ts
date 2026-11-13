import { ChangeDetectionStrategy, Component } from '@angular/core';

// mon-lego-checked: no Ecology component draws an entity diagram. This is inline SVG built from
// the table list below, styled with tokens; the card look copies esa-card (raised header band,
// default border, card radius).

type Key = 'PK' | 'FK' | 'JSON';

interface Field {
  name: string;
  key?: Key;
  /** Right-hand note, for the DashboardConfig keys. */
  note?: string;
}

interface Entity {
  id: string;
  name: string;
  x: number;
  y: number;
  fields: Field[];
  /** Drawn dashed: the keys inside a JSON column, not a table. */
  json?: boolean;
}

interface Endpoint {
  label: string;
  kind: 'service' | 'file' | 'ltinfo';
  y: number;
}

/** A relationship line. The path is drawn by hand so lines never cross a table. */
interface Link {
  d: string;
  start?: 'one';
  end?: 'many' | 'arrow';
  dashed?: boolean;
  label: string;
}

const W = 270;
const HEAD = 34;
const ROW = 22;
const PAD = 6;
const COL = [16, 366, 716];

const height = (e: Entity) => HEAD + e.fields.length * ROW + PAD;
/** The vertical middle of a field row. */
const rowY = (e: Entity, i: number) => e.y + HEAD + PAD / 2 + i * ROW + ROW / 2;

// The six tables in Sandbox.Database/dbo/Tables, columns in table order.
const ENTITIES: Entity[] = [
  {
    id: 'category',
    name: 'MonitoringProgramCategory',
    x: COL[0],
    y: 20,
    fields: [
      { name: 'MonitoringProgramCategoryID', key: 'PK' },
      { name: 'MonitoringProgramCategoryName' },
      { name: 'Folder' },
      { name: 'ThemeColor' },
      { name: 'SortOrder' },
      { name: 'Blurb' },
      { name: 'CategoryDescription' },
      { name: 'IconName' },
    ],
  },
  {
    id: 'organization',
    name: 'Organization',
    x: COL[0],
    y: 300,
    fields: [{ name: 'OrganizationID', key: 'PK' }, { name: 'OrganizationName' }, { name: 'OrganizationShortName' }],
  },
  {
    id: 'program-organization',
    name: 'MonitoringProgramOrganization',
    x: COL[0],
    y: 450,
    fields: [
      { name: 'MonitoringProgramOrganizationID', key: 'PK' },
      { name: 'MonitoringProgramID', key: 'FK' },
      { name: 'OrganizationID', key: 'FK' },
      { name: 'SortOrder' },
    ],
  },
  {
    id: 'program',
    name: 'MonitoringProgram',
    x: COL[1],
    y: 20,
    fields: [
      { name: 'MonitoringProgramID', key: 'PK' },
      { name: 'MonitoringProgramName' },
      { name: 'MonitoringProgramCategoryID', key: 'FK' },
      { name: 'MonitoringProgramDescription' },
      { name: 'MonitoringApproach' },
      { name: 'IsFeatured' },
      { name: 'Template' },
      { name: 'DashboardConfig', key: 'JSON' },
      { name: 'RelatedLinks', key: 'JSON' },
      { name: 'UpdateDate' },
    ],
  },
  {
    id: 'config',
    name: 'DashboardConfig keys',
    x: COL[1],
    y: 330,
    json: true,
    fields: [
      { name: 'measures', note: 'Charts' },
      { name: 'mapLayer', note: 'Map' },
      { name: 'sitesLayer', note: 'Site list' },
      { name: 'sitesPerYear', note: 'Sites per year' },
      { name: 'overlays', note: 'Map overlays' },
      { name: 'siteProfile', note: 'Site profile' },
    ],
  },
  {
    id: 'site',
    name: 'MonitoringSite',
    x: COL[2],
    y: 20,
    fields: [
      { name: 'MonitoringSiteID', key: 'PK' },
      { name: 'MonitoringProgramID', key: 'FK' },
      { name: 'SiteName' },
      { name: 'SiteKind' },
      { name: 'Latitude' },
      { name: 'Longitude' },
    ],
  },
  {
    id: 'image',
    name: 'MonitoringProgramImage',
    x: COL[2],
    y: 230,
    fields: [
      { name: 'MonitoringProgramImageID', key: 'PK' },
      { name: 'MonitoringProgramID', key: 'FK' },
      { name: 'FileResourceGUID' },
      { name: 'Caption' },
      { name: 'PhotoCredit' },
      { name: 'IsKeyPhoto' },
      { name: 'SortOrder' },
    ],
  },
];

const byId = (id: string) => ENTITIES.find((e) => e.id === id)!;

// Outside the database: where photos and chart and map rows come from.
const ENDPOINT_H = 40;
const ENDPOINTS: Endpoint[] = [
  { label: 'LT Info file resources', kind: 'ltinfo', y: 448 },
  { label: 'TRPA map service layers', kind: 'service', y: 516 },
  { label: 'Data files in data/', kind: 'file', y: 572 },
];

function links(): Link[] {
  const category = byId('category');
  const organization = byId('organization');
  const junction = byId('program-organization');
  const program = byId('program');
  const config = byId('config');
  const site = byId('site');
  const image = byId('image');
  const right = (e: Entity) => e.x + W;
  const pk = rowY(program, 0);
  const configMid = config.y + height(config) / 2;
  const endpoint = (i: number) => ENDPOINTS[i].y + ENDPOINT_H / 2;
  return [
    {
      label: 'A category has many programs',
      d: `M${right(category)},${rowY(category, 0)} H316 V${rowY(program, 2)} H${program.x}`,
      start: 'one',
      end: 'many',
    },
    {
      label: 'A program has many partner rows',
      d: `M${program.x},${program.y + height(program) - 20} H336 V${rowY(junction, 1)} H${right(junction)}`,
      start: 'one',
      end: 'many',
    },
    {
      label: 'An organization has many partner rows',
      d: `M${organization.x},${rowY(organization, 0)} H6 V${rowY(junction, 2)} H${junction.x}`,
      start: 'one',
      end: 'many',
    },
    {
      label: 'A program has many sites',
      d: `M${right(program)},${pk} H676 V${rowY(site, 1)} H${site.x}`,
      start: 'one',
      end: 'many',
    },
    {
      label: 'A program has many photos',
      d: `M${right(program)},${pk} H676 V${rowY(image, 1)} H${image.x}`,
      start: 'one',
      end: 'many',
    },
    {
      label: 'A photo file is stored in LT Info',
      d: `M${image.x + W / 2},${image.y + height(image)} V${ENDPOINTS[0].y}`,
      end: 'arrow',
      dashed: true,
    },
    {
      label: 'DashboardConfig holds the chart and map settings',
      d: `M${program.x + W / 2},${program.y + height(program)} V${config.y}`,
      end: 'arrow',
      dashed: true,
    },
    {
      label: 'The settings read map service layers',
      d: `M${right(config)},${configMid} H676 V${endpoint(1)} H${COL[2]}`,
      end: 'arrow',
      dashed: true,
    },
    {
      label: 'The settings read data files',
      d: `M${right(config)},${configMid} H676 V${endpoint(2)} H${COL[2]}`,
      end: 'arrow',
      dashed: true,
    },
  ];
}

/** The six tables and how they join, plus what lives outside the database. */
@Component({
  selector: 'app-schema-diagram',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrl: './schema-diagram.scss',
  template: `
    <div class="erd" tabindex="0" role="region" aria-label="Table diagram, scrolls sideways on a narrow screen">
      <svg class="erd__svg" viewBox="0 0 1000 628" role="img" aria-labelledby="erd-title erd-desc">
        <title id="erd-title">Sandbox database tables and their relationships</title>
        <desc id="erd-desc">{{ description }}</desc>
        <defs>
          <marker id="erd-one" viewBox="0 0 12 12" refX="6" refY="6" markerWidth="12" markerHeight="12" orient="auto-start-reverse">
            <path d="M3,1 V11" class="erd__mark" />
          </marker>
          <marker id="erd-many" viewBox="0 0 14 14" refX="13" refY="7" markerWidth="14" markerHeight="14" orient="auto">
            <path d="M13,1 L3,7 L13,13 M3,7 H13 M1,1 V13" class="erd__mark" />
          </marker>
          <marker id="erd-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto">
            <path d="M1,1 L9,5 L1,9" class="erd__mark" />
          </marker>
        </defs>

        @for (link of links; track link.label) {
          <path
            class="erd__link"
            [class.erd__link--dashed]="link.dashed"
            [attr.d]="link.d"
            [attr.marker-start]="link.start ? 'url(#erd-one)' : null"
            [attr.marker-end]="link.end ? 'url(#erd-' + link.end + ')' : null"
          >
            <title>{{ link.label }}</title>
          </path>
        }

        @for (e of entities; track e.id) {
          <g class="erd__entity" [class.erd__entity--json]="e.json" [attr.data-entity]="e.id">
            <rect class="erd__card" [attr.x]="e.x" [attr.y]="e.y" [attr.width]="width" [attr.height]="h(e)" rx="8" />
            <path class="erd__head" [attr.d]="headPath(e)" />
            <line class="erd__rule" [attr.x1]="e.x" [attr.x2]="e.x + width" [attr.y1]="e.y + head" [attr.y2]="e.y + head" />
            <text class="erd__name typography-label-md-strong" [attr.x]="e.x + 12" [attr.y]="e.y + 22">{{ e.name }}</text>
            @for (f of e.fields; track f.name; let i = $index) {
              <text class="erd__field typography-body-sm" [attr.x]="e.x + 12" [attr.y]="row(e, i) + 4">{{ f.name }}</text>
              @if (f.key) {
                <text
                  class="erd__key typography-label-xs-strong"
                  [attr.data-key]="f.key"
                  [attr.x]="e.x + width - 12"
                  [attr.y]="row(e, i) + 4"
                  text-anchor="end"
                >{{ f.key }}</text>
              }
              @if (f.note) {
                <text class="erd__note typography-body-xs" [attr.x]="e.x + width - 12" [attr.y]="row(e, i) + 4" text-anchor="end">{{ f.note }}</text>
              }
            }
          </g>
        }

        @for (p of endpoints; track p.label) {
          <g class="erd__endpoint" [attr.data-kind]="p.kind">
            <rect [attr.x]="col" [attr.y]="p.y" [attr.width]="width" [attr.height]="endpointH" rx="20" />
            <text class="typography-label-sm-strong" [attr.x]="col + width / 2" [attr.y]="p.y + 25" text-anchor="middle">{{ p.label }}</text>
          </g>
        }
      </svg>
    </div>
    <ul class="erd-key typography-body-xs" aria-label="Diagram key">
      <li><span class="erd-key__tag typography-label-xs-strong" data-key="PK">PK</span> Primary key</li>
      <li><span class="erd-key__tag typography-label-xs-strong" data-key="FK">FK</span> Foreign key</li>
      <li><span class="erd-key__tag typography-label-xs-strong" data-key="JSON">JSON</span> JSON text column</li>
      <li>
        <svg class="erd-key__line" viewBox="0 0 40 14" aria-hidden="true"><path d="M2,7 H38 M30,1 L38,7 L30,13 M38,1 V13" /></svg>
        One to many
      </li>
    </ul>
  `,
})
export class SchemaDiagram {
  protected readonly entities = ENTITIES;
  protected readonly endpoints = ENDPOINTS;
  protected readonly links = links();
  protected readonly width = W;
  protected readonly head = HEAD;
  protected readonly endpointH = ENDPOINT_H;
  protected readonly col = COL[2];
  protected readonly description = links()
    .map((l) => l.label)
    .join('. ');

  protected h(e: Entity): number {
    return height(e);
  }

  protected row(e: Entity, i: number): number {
    return rowY(e, i);
  }

  /** The header band: the card's top corners rounded, square at the rule. */
  protected headPath(e: Entity): string {
    const r = 8;
    return `M${e.x},${e.y + HEAD} V${e.y + r} Q${e.x},${e.y} ${e.x + r},${e.y} H${e.x + W - r} Q${e.x + W},${e.y} ${e.x + W},${e.y + r} V${e.y + HEAD} Z`;
  }
}
