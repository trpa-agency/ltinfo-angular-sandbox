// The building blocks every page template is made of. A template is only an
// order and a set of proportions for these; none of them knows which template
// it is in.
//
//   app-band                a titled section of the page
//   app-measurements-block  one chart panel per measure, paired by panelSpans
//   app-sites-block         the map and site list, for a program that has sites or areas
//   app-per-year-block      the "sites monitored each year" chart, when it is configured
//   app-program-story       description and monitoring approach
//   app-program-partners    the partner organizations, and the program's pages on the other dashboards
//
// A block with nothing to show renders the house empty state: what is absent,
// then what the section will show. The two site blocks are the exception: a program with no
// sites has no Sites section, so the templates leave them out instead of showing them empty.
import { ChangeDetectionStrategy, Component, booleanAttribute, computed, input } from '@angular/core';

import type { Partner, RelatedLink } from '../../api/models';
import { EsaBadge } from '../../ecology/esa-badge';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import { ChartPanel } from '../chart-panel/chart-panel';
import { SitesPanel } from '../sites-panel/sites-panel';
import { TileTracker } from '../summary-tiles/tile-tracker';
import { EMPTY_TEXT, ProgramData, SITES_PER_YEAR_KEY, measureKey } from './program-data';

let bandCount = 0;

// A band is one titled section: a small heading on the page, then its cards.
// The templates put data-section on it so the order of a page can be read
// from the document. The band a template leads with passes `lead`: its heading
// stays in the outline for screen readers but is not drawn, so the lead cards
// sit straight under the header.
@Component({
  selector: 'app-band',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { '[attr.data-lead]': 'lead() ? "" : null' },
  template: `
    <section class="band" [attr.aria-labelledby]="id">
      <h2
        class="band__title typography-title-sm-strong"
        [class.visually-hidden]="lead()"
        [id]="id"
      >
        {{ title() }}
      </h2>
      <div class="band__body"><ng-content /></div>
    </section>
  `,
  styleUrl: './blocks.scss',
})
export class Band {
  readonly title = input.required<string>();
  /** The first band of a template: the heading is kept for the outline and hidden from view. */
  readonly lead = input(false, { transform: booleanAttribute });
  protected readonly id = `band-${++bandCount}`;
}

@Component({
  selector: 'app-measurements-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartPanel, EsaCard, EsaEmptyState],
  template: `
    @if (data().measures.length > 0) {
      <div class="measures">
        @for (measure of data().measures; track $index) {
          <app-chart-panel
            [class]="data().spans[$index]"
            [measure]="measure"
            [programName]="programName()"
            (loaded)="tracker().chartLoaded($event)"
            (settled)="tracker().chartSettled(key($index), $event)"
          />
        }
      </div>
    } @else {
      <esa-card>
        <div class="empty">
          <esa-empty-state
            size="sm"
            [title]="empty.title"
            [description]="empty.description"
          />
        </div>
      </esa-card>
    }
  `,
  styleUrl: './blocks.scss',
})
export class MeasurementsBlock {
  readonly data = input.required<ProgramData>();
  readonly programName = input.required<string>();
  readonly tracker = input.required<TileTracker>();

  protected readonly empty = EMPTY_TEXT.measurements;
  protected readonly key = measureKey;
}

@Component({
  selector: 'app-sites-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [SitesPanel],
  template: `
    @if (data().sites; as sites) {
      <app-sites-panel
        [config]="sites"
        [tall]="tall()"
        (loaded)="tracker().sitesLoaded($event)"
        (settled)="tracker().sitesSettled($event)"
      />
    }
  `,
  styleUrl: './blocks.scss',
})
export class SitesBlock {
  readonly data = input.required<ProgramData>();
  readonly tracker = input.required<TileTracker>();
  /** A taller map, for the map template. */
  readonly tall = input(false, { transform: booleanAttribute });
}

@Component({
  selector: 'app-per-year-block',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ChartPanel],
  template: `
    <!-- Nothing is drawn without a per-year source: a page with no sites has none to count. -->
    @if (data().perYear; as perYear) {
      <app-chart-panel
        [measure]="perYear.measure"
        [source]="perYear.source"
        [programName]="programName()"
        [emptyText]="empty"
        (loaded)="tracker().chartLoaded($event)"
        (settled)="tracker().chartSettled(key, $event)"
      />
    }
  `,
  styleUrl: './blocks.scss',
})
export class PerYearBlock {
  readonly data = input.required<ProgramData>();
  readonly programName = input.required<string>();
  readonly tracker = input.required<TileTracker>();

  protected readonly empty = EMPTY_TEXT.sitesPerYear;
  protected readonly key = SITES_PER_YEAR_KEY;
}

// The story: the program description, then the monitoring approach, each as
// the paragraphs the author typed. The content template shows the first
// paragraph of the description in its header and passes the rest here.
@Component({
  selector: 'app-program-story',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EsaCard, EsaEmptyState],
  template: `
    <esa-card [title]="'Program Description'">
      @if (description().length > 0 || approach().length > 0) {
        <div class="prose">
          @for (paragraph of description(); track $index) {
            <p>{{ paragraph }}</p>
          }
          @if (approach().length > 0) {
            <h4 class="prose__heading typography-label-md-strong">Monitoring Approach</h4>
            @for (paragraph of approach(); track $index) {
              <p>{{ paragraph }}</p>
            }
          }
        </div>
      } @else {
        <div class="empty empty--short">
          <esa-empty-state
            size="sm"
            [title]="empty.title"
            [description]="empty.description"
          />
        </div>
      }
    </esa-card>
  `,
  styleUrl: './blocks.scss',
})
export class ProgramStory {
  /** Paragraphs of the description to show. */
  readonly description = input.required<readonly string[]>();
  /** Paragraphs of the monitoring approach. */
  readonly approach = input.required<readonly string[]>();

  protected readonly empty = EMPTY_TEXT.about;
}

@Component({
  selector: 'app-program-partners',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EsaBadge, EsaCard, EsaEmptyState],
  template: `
    <div class="side-stack">
    <esa-card [title]="'Partners'">
      <!-- A block with one root element is projected into the slot its root names. -->
      @if (partners().length > 0) {
        <span slot="actions" class="count">
          <esa-badge [value]="partners().length" size="sm" />
          <span class="visually-hidden">partner organizations</span>
        </span>
      }
      @if (partners().length > 0) {
        <ul class="partners">
          @for (partner of partners(); track partner.OrganizationID) {
            <li>
              {{ partner.OrganizationName }}
              @if (partner.OrganizationShortName) {
                <span class="partners__short">({{ partner.OrganizationShortName }})</span>
              }
            </li>
          }
        </ul>
      } @else {
        <div class="empty empty--short">
          <esa-empty-state
            size="sm"
            [title]="empty.title"
            [description]="empty.description"
          />
        </div>
      }
    </esa-card>
    <!-- mon-lego-checked: esa-card holds the list; Ecology has no link-list lego, so the grouped
         list of plain links is custom. -->
    @if (groups().length > 0) {
      <esa-card [title]="'On Other Dashboards'" class="dashboards">
        @for (group of groups(); track group.dashboard) {
          <h3 class="dashboards__name typography-label">{{ group.dashboard }}</h3>
          <ul class="dashboards__links">
            @for (link of group.links; track link.Url) {
              <li><a [href]="link.Url" target="_blank" rel="noopener">{{ link.Label }}</a></li>
            }
          </ul>
        }
      </esa-card>
    }
    </div>
  `,
  styleUrl: './blocks.scss',
})
export class ProgramPartners {
  readonly partners = input.required<readonly Partner[]>();
  /** Pages on the other LT Info dashboards for the program's indicators, grouped by dashboard. */
  readonly links = input<readonly RelatedLink[]>([]);
  protected readonly groups = computed(() => {
    const byDashboard = new Map<string, RelatedLink[]>();
    for (const link of this.links()) byDashboard.set(link.Dashboard, [...(byDashboard.get(link.Dashboard) ?? []), link]);
    return [...byDashboard].map(([dashboard, links]) => ({ dashboard, links }));
  });

  protected readonly empty = EMPTY_TEXT.partners;
}
