import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

import { EsaBadge } from '../../ecology/esa-badge';
import { EsaButton } from '../../ecology/esa-button';
import type { ChartSpec } from '../../lib/chart/types';
import {
  chartRows,
  indicatorRows,
  latestSample,
  loadComparison,
  loadPhotos,
  loadRecord,
  medianByYear,
  profileChartSpec,
  profileCsv,
  profileView,
  resolveRecord,
  resolveRowSource,
  rowForYear,
  standardLine,
  statusStrip,
  stripPhases,
  type Comparison,
  type ProfilePhoto,
  type ProfileSubject,
  type RecordResult,
  type ResolvedRecord,
  type SiteProfileConfig,
} from '../../lib/site-profile';
import { INACTIVE_COLOR, plural, SERIES_COLORS, type FetchLike, type SitesPanelConfig } from '../../lib/sites';
import { ProfileChart } from './profile-chart';

/** idle until a site is picked; ready also covers a profile with nothing more to load. */
export type ProfileState = 'idle' | 'loading' | 'ready' | 'error';

/** Where the card is shown: floating over the map in its popup, or docked under the map. */
export type ProfileMode = 'floating' | 'docked';

interface ChartView {
  spec: ChartSpec;
  caption: string;
  /** Accessible name of the chart image and caption of its table. */
  name: string;
  rows: { year: number; value: string; median: string }[];
  line: string;
}

let nextId = 0;

/** A measurement unit worth naming in the chart caption ("dBA", "mg/L"); plain words such as "plants" are left to the facts. */
function captionUnit(unit: string | undefined): string {
  return unit && !/^[a-z ]+$/.test(unit) ? ` (${unit})` : '';
}

function download(fileName: string, text: string): void {
  const link = document.createElement('a');
  link.href = URL.createObjectURL(new Blob([text], { type: 'text/csv;charset=utf-8' }));
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

/**
 * The site profile: what a picked site or area is, who runs it, how long it has been
 * monitored, its latest value against the standard and the other sites, how it has changed,
 * and the program's own section, without leaving the map. It opens at once with what the map
 * knows and fills in as the record arrives; a record that fails leaves those facts in place.
 *
 * The data comes from lib/site-profile; this component loads it, keeps the state, and draws it.
 * The panel decides where the card sits (mode) and moves it in and out of the map's popup.
 *
 *   host data-state = idle | loading | ready | error, data-mode, data-records (rows behind it)
 */
@Component({
  selector: 'app-site-profile',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [EsaBadge, EsaButton, ProfileChart],
  host: {
    class: 'site-profile',
    '[attr.data-state]': 'state()',
    '[attr.data-mode]': 'mode()',
    '[attr.data-records]': 'recordCount()',
    '[attr.data-ms]': 'loadMs()',
    '(keydown.escape)': 'onEscape($event)',
  },
  templateUrl: './site-profile-card.html',
  styleUrl: './site-profile-card.scss',
})
export class SiteProfileCard {
  /** The picked site or area, or null for none. */
  readonly subject = input<ProfileSubject | null>(null);
  /** The program's DashboardConfig.siteProfile, or null. */
  readonly profile = input<SiteProfileConfig | null>(null);
  readonly panel = input.required<SitesPanelConfig>();
  readonly mode = input<ProfileMode>('floating');

  /** The close button or Escape. */
  readonly closed = output<void>();
  /** Zoom to site, with the subject's key. */
  readonly zoom = output<string>();
  /** The card changed height, so a floating card can be kept inside the map. */
  readonly resized = output<void>();

  protected readonly headingId = `site-profile-${(nextId += 1)}`;
  protected readonly state = signal<ProfileState>('idle');
  protected readonly main = signal<RecordResult | null>(null);
  protected readonly related = signal<RecordResult[]>([]);
  protected readonly comparison = signal<Comparison | null>(null);
  protected readonly loadMs = signal<number | null>(null);
  /** Attached photos, once listed; empty while loading, when there are none, or on a failed listing. */
  protected readonly photos = signal<ProfilePhoto[]>([]);
  protected readonly photosLoading = signal(false);
  /** Index of the photo in the larger view, or -1. */
  protected readonly photoIndex = signal(-1);
  protected readonly photoShown = computed(() => this.photos()[this.photoIndex()] ?? null);
  /** The first tiles shown; the rest open from the last tile and page in the larger view. */
  protected readonly PHOTO_TILES = 4;
  protected readonly photoTitle = computed(() => this.profile()?.photos?.title || 'Photos');
  protected readonly photoCredit = computed(() => this.profile()?.photos?.credit || '');
  private readonly photoDialog = viewChild<ElementRef<HTMLDialogElement>>('photoDialog');

  protected readonly unitPlural = computed(() => plural(2, this.subject()?.unit || 'site'));

  protected readonly view = computed(() => {
    const subject = this.subject();
    if (!subject) return { name: '', badge: '', owner: '', facts: [], context: [], link: null };
    return profileView(this.profile(), subject, this.main(), this.comparison());
  });

  protected readonly recordCount = computed(() => {
    const main = this.main();
    if (!main) return null;
    return main.record.stat ? main.yearly.length : main.rows.length;
  });

  protected readonly mainChart = computed<ChartView | null>(() => {
    const main = this.main();
    const subject = this.subject();
    if (!main || !subject) return null;
    return this.chartView(main, subject, this.comparison());
  });

  /** "No samples on record for this station." when the record loaded and holds no value for the site. */
  protected readonly emptyRecord = computed(() => {
    const main = this.main();
    const subject = this.subject();
    if (!main || !subject || !main.record.value || main.yearly.length || this.related().some((r) => r.yearly.length)) return '';
    // Rows without a value (an SEZ unit not assessed) lack the value; no rows at all lack the records.
    if (main.rows.length) return `No ${main.record.label.toLowerCase()} on record for this ${subject.unit}.`;
    const noun = main.record.noun?.[1] || 'records';
    return `No ${noun} on record for this ${subject.unit}.`;
  });

  protected readonly relatedCharts = computed<ChartView[]>(() => {
    const subject = this.subject();
    if (!subject) return [];
    return this.related()
      .map((result) => this.chartView(result, subject, null))
      .filter((chart): chart is ChartView => chart != null);
  });

  protected readonly indicators = computed(() => {
    const section = this.profile()?.section;
    const subject = this.subject();
    if (section?.type !== 'indicators' || !subject) return null;
    const pick = this.panel().mapLayer?.pick;
    const row = rowForYear(this.main(), pick ? subject.props[pick] : null);
    const colors = this.panel().mapLayer?.colors || {};
    const rows = indicatorRows(section, row).map((r) => ({ ...r, color: colors[r.rating] || INACTIVE_COLOR }));
    return rows.length ? { title: section.title, rows } : null;
  });

  protected readonly strip = computed(() => {
    const section = this.profile()?.section;
    if (section?.type !== 'statusStrip') return null;
    const cells = statusStrip(section, this.main()?.latest ?? null);
    if (!cells.some((c) => c.code)) return null;
    const legend = stripPhases(section, SERIES_COLORS);
    const colorOf = new Map(legend.map((l) => [l.phase, l.color]));
    const shown = cells.map((c) => ({ ...c, color: colorOf.get(c.phase) ?? 'transparent' }));
    return {
      title: section.title,
      cells: shown,
      legend: legend.filter((l) => cells.some((c) => c.phase === l.phase)),
      // Latest year first: what is being done now leads.
      actions: [...cells].reverse().filter((c) => c.actions),
    };
  });

  protected readonly latest = computed(() => {
    if (this.profile()?.section?.type !== 'latest') return [];
    return [this.main(), ...this.related()]
      .filter((r): r is RecordResult => r != null)
      .map(latestSample)
      .filter((s): s is [string, string, string] => s != null);
  });
  protected readonly latestTitle = computed(() => {
    const section = this.profile()?.section;
    return section?.type === 'latest' ? section.title : '';
  });

  private readonly heading = viewChild<ElementRef<HTMLElement>>('heading');
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private abort: AbortController | null = null;
  private run = 0;

  constructor() {
    effect(() => {
      const subject = this.subject();
      const profile = this.profile();
      const panel = this.panel();
      untracked(() => void this.load(subject, profile, panel));
    });
    // A floating card that grows as its record lands is kept inside the map.
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => this.resized.emit());
    });
    observer.observe(this.host);
    inject(DestroyRef).onDestroy(() => {
      this.run++;
      this.abort?.abort();
      cancelAnimationFrame(frame);
      observer.disconnect();
    });
  }

  /** Move focus to the card's heading (opened from the list or the keyboard). */
  focus(scroll: boolean): void {
    this.heading()?.nativeElement.focus({ preventScroll: !scroll });
  }

  protected onEscape(event: Event): void {
    if (this.state() === 'idle') return;
    event.stopPropagation();
    this.closed.emit();
  }

  protected download(): void {
    const subject = this.subject();
    if (!subject) return;
    const results = [this.main(), ...this.related()].filter((r): r is RecordResult => r != null);
    const file = profileCsv(this.panel().program, subject, results);
    download(file.fileName, file.text);
  }

  private chartView(result: RecordResult, subject: ProfileSubject, comparison: Comparison | null): ChartView | null {
    const { record, yearly } = result;
    if (yearly.length < 3) return null;
    const first = yearly[0].year;
    const last = yearly[yearly.length - 1].year;
    const medians = comparison && record.compare !== false ? medianByYear(comparison, first, last) : [];
    const unitPlural = this.unitPlural();
    return {
      spec: profileChartSpec(record.label, yearly, medians, result.standard, record, unitPlural),
      caption: `${record.label}${captionUnit(record.unit)}`,
      name: `${record.label} at ${subject.name}, ${first} to ${last}`,
      rows: chartRows(yearly, medians, record.decimals),
      line: comparison == null && result.standard != null ? `${standardLine(yearly, result.standard, record) ?? ''}.` : '',
    };
  }

  /** Opens the larger view at a photo. */
  protected openPhoto(index: number): void {
    this.photoIndex.set(index);
    const dialog = this.photoDialog()?.nativeElement;
    if (dialog && !dialog.open) dialog.showModal();
  }

  /** Previous or next photo, wrapping around. */
  protected stepPhoto(delta: number): void {
    const count = this.photos().length;
    if (count) this.photoIndex.update((i) => (i + delta + count) % count);
  }

  protected onPhotoKey(event: KeyboardEvent): void {
    if (event.key === 'ArrowRight') this.stepPhoto(1);
    else if (event.key === 'ArrowLeft') this.stepPhoto(-1);
    else return;
    event.preventDefault();
  }

  /** A click on the backdrop (the dialog element itself, outside the panel) closes it. */
  protected photoBackdrop(event: MouseEvent): void {
    if (event.target === this.photoDialog()?.nativeElement) this.photoDialog()?.nativeElement.close();
  }

  /** Lists the site's attached photos, independent of the record: a failure only hides the section. */
  private loadSitePhotos(run: number, http: FetchLike, subject: ProfileSubject, profile: SiteProfileConfig | null, panel: SitesPanelConfig): void {
    const cfg = profile?.photos;
    const layer = cfg?.layer ?? panel.mapLayer?.layer ?? panel.sitesLayer?.layer;
    if (!cfg || layer == null) return;
    this.photosLoading.set(true);
    loadPhotos(http, cfg, layer, subject)
      .then((photos) => {
        if (run === this.run) this.photos.set(photos);
      })
      .catch((error: unknown) => {
        if (run === this.run) console.warn(`The photos of ${subject.name} did not load: ${String(error)}`);
      })
      .finally(() => {
        if (run === this.run) this.photosLoading.set(false);
      });
  }

  private async load(subject: ProfileSubject | null, profile: SiteProfileConfig | null, panel: SitesPanelConfig): Promise<void> {
    const run = ++this.run;
    this.abort?.abort();
    this.main.set(null);
    this.related.set([]);
    this.comparison.set(null);
    this.loadMs.set(null);
    this.photos.set([]);
    this.photosLoading.set(false);
    this.photoIndex.set(-1);
    this.photoDialog()?.nativeElement.close();
    if (!subject) {
      this.state.set('idle');
      return;
    }
    const photoAbort = (this.abort = new AbortController());
    this.loadSitePhotos(run, (url) => fetch(url, { signal: photoAbort.signal }), subject, profile, panel);
    const mainRecord: ResolvedRecord | null = profile?.record
      ? resolveRecord(profile.record, panel)
      : profile && subject.kind === 'site'
        ? resolveRowSource(panel)
        : null;
    const relatedRecords = (profile?.related || [])
      .map((r) => resolveRecord(r, panel))
      .filter((r): r is ResolvedRecord => r != null);
    if (!mainRecord && !relatedRecords.length) {
      this.state.set('ready');
      return;
    }
    const abort = photoAbort;
    const http: FetchLike = (url) => fetch(url, { signal: abort.signal });
    const current = () => run === this.run;
    const started = performance.now();
    this.state.set('loading');

    const comparing = mainRecord && mainRecord.value && mainRecord.compare !== false;
    const comparison = comparing
      ? loadComparison(http, mainRecord).catch((error: unknown) => {
          if (current()) console.warn(`The comparison with the other sites did not load: ${String(error)}`);
          return null;
        })
      : Promise.resolve(null);
    const related = Promise.all(
      relatedRecords.map((r) =>
        loadRecord(http, r, subject).catch((error: unknown) => {
          if (current()) console.warn(`${r.label} did not load: ${String(error)}`);
          return null;
        }),
      ),
    );
    try {
      const main = mainRecord ? await loadRecord(http, mainRecord, subject) : null;
      if (!current()) return;
      this.main.set(main);
      const [others, compared] = await Promise.all([related, comparison]);
      if (!current()) return;
      this.related.set(others.filter((r): r is RecordResult => r != null));
      this.comparison.set(compared);
      this.loadMs.set(Math.round(performance.now() - started));
      this.state.set('ready');
    } catch (error) {
      if (!current()) return;
      console.warn(`The record of ${subject.name} did not load: ${String(error)}`);
      this.loadMs.set(Math.round(performance.now() - started));
      this.state.set('error');
    }
  }
}
