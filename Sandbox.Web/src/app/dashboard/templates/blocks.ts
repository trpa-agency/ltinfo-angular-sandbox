// The building blocks every page template is made of. A template is only an
// order and a set of proportions for these; none of them knows which template
// it is in.
//
//   app-band                a titled section of the page
//   app-measurements-block  one chart panel per measure, paired by panelSpans
//   app-sites-block         the map and site list, for a program that has sites or areas
//   app-per-year-block      the "sites monitored each year" chart, when it is configured
//   app-program-story       description and monitoring approach
//   app-program-partners    the partner organizations
//   app-header-links        the program's pages on the other dashboards, as one line in the header
//   app-filter-bar          the page filters, shown once above the map and charts
//
// A block with nothing to show renders the house empty state: what is absent,
// then what the section will show. The two site blocks are the exception: a program with no
// sites has no Sites section, so the templates leave them out instead of showing them empty.
import {
  CUSTOM_ELEMENTS_SCHEMA,
  ChangeDetectionStrategy,
  Component,
  booleanAttribute,
  computed,
  input,
  output,
} from '@angular/core';

import type { Partner, RelatedLink } from '../../api/models';
import type { FilterState, PageFilter } from '../../lib/page-filters';
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
    </div>
  `,
  styleUrl: './blocks.scss',
})
export class ProgramPartners {
  readonly partners = input.required<readonly Partner[]>();

  protected readonly empty = EMPTY_TEXT.partners;
}

// The program's pages on the other LT Info dashboards, as one line under the lead in the
// header: the Threshold Dashboard has the status against the standard, which a monitoring
// page does not repeat, so the way to it sits at the top and not in a card at the foot.
//
// mon-lego-checked: Ecology has no link-list lego in the vendored set (badge, button, card,
// empty state, stat), so the line of plain links is custom, tokens only.
@Component({
  selector: 'app-header-links',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (links().length > 0) {
      <ul class="hlinks typography-body-sm" aria-label="On other dashboards">
        @for (link of links(); track link.Url) {
          <li>
            <a [href]="link.Url" target="_blank" rel="noopener">{{ link.Dashboard }}: {{ link.Label }}</a>
          </li>
        }
      </ul>
    }
  `,
  styleUrl: './blocks.scss',
})
export class HeaderLinks {
  readonly links = input.required<readonly RelatedLink[]>();
}

type EcologyChange = CustomEvent<{ value?: string | string[] }>;

interface FilterView {
  filter: PageFilter;
  /** Every option, with the choice that filters nothing first. Its value is the empty string. */
  options: { label: string; value: string }[];
  value: string;
}

// The page filters: one control a filter, shown once above the map and the charts, so a
// choice is made in one place and every panel on the filter's layer follows it. A filter of
// a few options is a button toggle, so the reader sees them all; a long one is a select.
//
// Lego: esa-button-toggle and esa-select (Ecology web components), in a plain flex row.
@Component({
  selector: 'app-filter-bar',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  host: { '[attr.data-active]': 'active()' },
  template: `
    <div class="filters" role="group" aria-label="Filter the map and charts">
      @for (view of views(); track view.filter.field) {
        @if (view.filter.style === 'buttons') {
          <esa-button-toggle
            class="filters__control"
            size="sm"
            [attr.data-field]="view.filter.field"
            [label]="view.filter.label"
            [options]="view.options"
            [value]="view.value"
            (change)="onChange(view.filter, $event)"
          ></esa-button-toggle>
        } @else {
          <esa-select
            class="filters__control filters__control--select"
            size="sm"
            [attr.data-field]="view.filter.field"
            [label]="view.filter.label"
            [options]="view.options"
            [value]="view.value"
            (change)="onChange(view.filter, $event)"
          ></esa-select>
        }
      }
    </div>
  `,
  styleUrl: './blocks.scss',
})
export class FilterBar {
  readonly filters = input.required<readonly PageFilter[]>();
  readonly chosen = input.required<FilterState>();
  /** A filter changed: its field, and the label of the option chosen ('' for all). */
  readonly choose = output<{ field: string; label: string }>();

  protected readonly views = computed<FilterView[]>(() =>
    this.filters().map((filter) => ({
      filter,
      options: [
        { label: filter.allLabel ?? 'All', value: '' },
        ...filter.options.map((option) => ({ label: option.label, value: option.label })),
      ],
      value: this.chosen()[filter.field] ?? '',
    })),
  );

  /** How many filters have an option chosen, for the tests. */
  protected readonly active = computed(() => this.views().filter((view) => view.value !== '').length);

  protected onChange(filter: PageFilter, event: Event): void {
    const value = (event as EcologyChange).detail?.value;
    if (typeof value !== 'string' || value === (this.chosen()[filter.field] ?? '')) return;
    this.choose.emit({ field: filter.field, label: value });
  }
}
