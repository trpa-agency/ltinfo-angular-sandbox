import {
  afterNextRender,
  booleanAttribute,
  ChangeDetectionStrategy,
  Component,
  computed,
  CUSTOM_ELEMENTS_SCHEMA,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  input,
  output,
  signal,
  untracked,
  viewChild,
} from '@angular/core';

// The real Ecology Lit elements; this import registers esa-select once for the app.
import '../../../ecology/ecology-elements.js';

import { EsaButton } from '../../ecology/esa-button';
import { EsaCard } from '../../ecology/esa-card';
import { EsaEmptyState } from '../../ecology/esa-empty-state';
import {
  areaGroups,
  areaListItems,
  areaQueryParams,
  areasCsv,
  areasLayerSpec,
  displayLayer,
  prepareAreaFeatures,
  areasSummary,
  collapseSites,
  fetchAttributes,
  featureKey,
  fetchGeoJson,
  INACTIVE_COLOR,
  overlayQueryParams,
  overlaySpec,
  pickChoices,
  pickStatsParams,
  plural,
  siteGroups,
  siteListItems,
  siteStatus,
  sitesCsv,
  sitesLayerSpec,
  sitesPanelSource,
  sitesPanelTitle,
  sitesPanelUnit,
  sitesQueryParams,
  sitesSourceKind,
  sitesSummary,
  slugify,
  statusColors,
  type FeatureCollection,
  type FetchLike,
  type Feature,
  type ListGroup,
  type ListItem,
  type MapLayers,
  type OverlaySpec,
  type PanelState,
  type Site,
  type SitesPanelConfig,
  type SitesSummary,
} from '../../lib/sites';
import { areaSubject, siteSubject, type ProfileSubject, type SiteProfileConfig } from '../../lib/site-profile';
import { SiteList } from './site-list';
import { SiteProfileCard } from './site-profile-card';
import { SitesMap } from './sites-map';

/**
 * Under this map width the site profile docks under the map instead of taking the list column.
 * Phones only: a laptop's map beside the program page's category menu is about 580 px.
 */
const DOCK_BELOW_PX = 480;

/** The fields of an area the profile's joins read (SEZ_ID), so the area query asks for them. */
function profileFields(profile: SiteProfileConfig | null): string[] {
  const joins = [profile?.record, ...(profile?.related || [])].map((r) => r?.join?.from);
  return joins.filter((f): f is string => !!f && !['name', 'code', 'key'].includes(f));
}

interface PickOption {
  label: string;
  value: string;
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
 * The Sites section of a program page: a card with a Leaflet map on one side and the synced
 * list on the other. It reads a SitesPanelConfig (lib/sites) and loads exactly one source
 * from the TRPA map service, in this order of preference:
 *   mapLayer    areas (polygons or lines) colored by colorBy, one pick value at a time
 *   sitesLayer  points from a layer with one feature per site per year, collapsed per site
 *   geojson     points from a GeoJSON URL
 * plus the overlays drawn under it.
 *
 * The contract the page templates and the tests rely on:
 *   selector  app-sites-panel
 *   inputs    config (required), tall
 *   outputs   loaded (SitesSummary, on each load and again after a pick change),
 *             settled (ready, empty, or error)
 *   host      data-state = loading | ready | empty | error
 *
 * CUSTOM_ELEMENTS_SCHEMA is here for esa-select only (the pick). Its value arrives in
 * $event.detail.value of the lowercase "change" event, and option values are strings.
 *
 * A click on a site or area, on the map or in the list, opens its site profile
 * (app-site-profile) in the list column, in the list's place, so the map stays fully visible;
 * Back to List returns. Under a narrow map, or when there is no list, it docks under the map.
 * The site stays marked on the map while it is open. The profile takes focus when it opens;
 * closing it returns focus to the opener.
 */
@Component({
  selector: 'app-sites-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
  // Contract: the host element always carries data-state = loading | ready | empty | error.
  host: { '[attr.data-state]': 'state()' },
  imports: [EsaButton, EsaCard, EsaEmptyState, SiteList, SiteProfileCard, SitesMap],
  templateUrl: './sites-panel.html',
  styleUrl: './sites-panel.scss',
})
export class SitesPanel {
  /** loading, ready, empty, or error; mirrored to data-state on the host. */
  protected readonly state = signal<PanelState>('loading');

  /** Program name, category color, and the program's sitesLayer or mapLayer plus overlays. */
  readonly config = input.required<SitesPanelConfig>();
  /** A taller map, for the map template. */
  readonly tall = input(false, { transform: booleanAttribute });

  /** Fires when sites or areas have loaded (and again after a pick change). */
  readonly loaded = output<SitesSummary>();
  /** Fires when the panel reaches ready, empty, or error. */
  readonly settled = output<PanelState>();

  protected readonly title = computed(() => sitesPanelTitle(this.config()));
  protected readonly unit = computed(() => sitesPanelUnit(this.config()));
  /** "sites", "stations", "assessment units": lowercase, for sentences. */
  protected readonly unitPlural = computed(() => {
    const layer = this.config().mapLayer;
    return (layer?.unitPlural || plural(2, this.unit())).toLowerCase();
  });
  protected readonly source = computed(() => sitesPanelSource(this.config()));
  /** false only for an area layer with list: false; the map then fills the card. */
  protected readonly showList = computed(() => this.config().mapLayer?.list !== false);
  protected readonly pickLabel = computed(() => {
    const layer = this.config().mapLayer;
    return layer?.pickLabel || layer?.pick || 'Show';
  });
  protected readonly emptyTitle = computed(() => `No ${this.unitPlural()} loaded yet`);
  protected readonly emptyDescription = computed(() =>
    this.showList()
      ? `This section will show the ${this.unitPlural()} on a map with a list beside it.`
      : `This section will show the ${this.unitPlural()} on a map.`,
  );

  protected readonly layers = signal<MapLayers | null>(null);
  protected readonly items = signal<ListItem[]>([]);
  protected readonly groups = signal<ListGroup[]>([]);
  protected readonly selectedKey = signal<string | null>(null);
  /** The pick values as select options, latest first; the select shows only when there are two or more. */
  protected readonly pickOptions = signal<PickOption[]>([]);
  protected readonly picked = signal<string | number | null>(null);
  protected readonly pickedValue = computed(() => (this.picked() == null ? '' : String(this.picked())));
  /** Features received so far on a layer that takes more than one request, else 0. */
  protected readonly progress = signal(0);
  protected readonly loadingText = computed(() => {
    const picked = this.picked();
    return `Loading ${this.unitPlural()}${picked == null ? '' : ` for ${picked}`}`;
  });
  protected readonly progressText = computed(() => {
    const count = this.progress();
    return count ? `${count.toLocaleString('en-US')} received so far` : '';
  });
  protected readonly listMessage = computed(() => {
    switch (this.state()) {
      case 'loading':
        return this.loadingText();
      case 'error':
        return 'Data could not be loaded.';
      default:
        return '';
    }
  });

  private readonly map = viewChild(SitesMap);
  private readonly list = viewChild(SiteList);
  private readonly profileCard = viewChild(SiteProfileCard);
  private readonly mapColumn = viewChild.required<ElementRef<HTMLElement>>('mapColumn');
  private readonly dock = viewChild.required<ElementRef<HTMLElement>>('dock');
  private readonly rail = viewChild<ElementRef<HTMLElement>>('rail');
  private readonly card = viewChild.required<ElementRef<HTMLElement>>('card');
  /** Set once the view exists; the card and the dock are only touched after it. */
  private viewReady = false;
  private readonly injector = inject(Injector);

  /** The picked site or area, or null when no profile is open. */
  protected readonly subject = signal<ProfileSubject | null>(null);
  /** The program's site profile settings, once known; null when it has none. */
  protected readonly profileConfig = signal<SiteProfileConfig | null>(null);
  /** The map is narrower than DOCK_BELOW_PX. */
  private readonly narrow = signal(false);
  /** Where an open profile goes: the list column, or the dock under the map. */
  protected readonly placement = computed<'rail' | 'dock'>(() => (this.narrow() || !this.showList() ? 'dock' : 'rail'));
  /** The profile is open in the list column, so the list is hidden. */
  protected readonly railOpen = computed(() => !!this.subject() && this.placement() === 'rail');
  /** Where focus goes back to when the profile closes: the list row, or the map. */
  private opener: HTMLElement | null = null;
  private readonly sitesByKey = new Map<string, Site>();
  private siteColors: Record<string, string> = {};
  private readonly areasByKey = new Map<string, Feature>();
  private profileReady: Promise<SiteProfileConfig | null> = Promise.resolve(null);

  /** The config as text: a parent that hands over an equal object again does not restart the load. */
  private readonly configKey = computed(() => JSON.stringify(this.config()));
  /** Counts loads of a config, so an answer for an earlier config is dropped. */
  private run = 0;
  /** Counts area loads within a config, so an answer for an earlier pick is dropped. */
  private pickRun = 0;
  private abort: AbortController | null = null;
  private areaAbort: AbortController | null = null;
  private pickValues: (string | number)[] = [];
  private overlays: Promise<OverlaySpec[]> = Promise.resolve([]);
  private csv: (() => { fileName: string; text: string }) | null = null;

  constructor() {
    effect(() => {
      this.configKey();
      untracked(() => void this.start());
    });
    // Rail or dock follows the map's own width; an open profile moves with it.
    let observer: ResizeObserver | null = null;
    afterNextRender(() => {
      this.viewReady = true;
      observer = new ResizeObserver((entries) => {
        const width = entries[entries.length - 1].contentRect.width;
        if (width > 0) this.narrow.set(width < DOCK_BELOW_PX);
      });
      observer.observe(this.mapColumn().nativeElement);
    });
    effect(() => {
      this.placement();
      untracked(() => this.placeCard());
    });
    inject(DestroyRef).onDestroy(() => {
      observer?.disconnect();
      this.run++;
      this.pickRun++;
      this.abort?.abort();
      this.areaAbort?.abort();
    });
  }

  /* ---------- wiring between the map, the list, the profile, the pick, and the CSV button ---------- */

  /** A row was clicked: fly the map there and open the site's profile, with focus in it. */
  protected onSiteSelect(key: string): void {
    this.openProfile(key, 'list');
  }

  /** A feature was clicked on the map: mark its row, bring it into view, and open its profile. */
  protected onFeatureSelect(key: string): void {
    this.list()?.reveal(key);
    this.openProfile(key, 'map');
  }

  /** The map reports a closed card; the profile no longer floats, so there is nothing to do. */
  protected onCardClosed(): void {}

  /** The profile's close button or Escape. */
  protected closeProfile(): void {
    this.endProfile(true);
  }

  protected onZoom(key: string): void {
    this.map()?.zoomTo(key);
  }

  private subjectFor(key: string): ProfileSubject | null {
    const cfg = this.config();
    const site = this.sitesByKey.get(key);
    if (site) return siteSubject(site, this.siteColors[siteStatus(site)] || INACTIVE_COLOR, this.unit());
    const feature = this.areasByKey.get(key);
    if (feature && cfg.mapLayer) return areaSubject(cfg.mapLayer, feature, key, cfg.color);
    return null;
  }

  private openProfile(key: string, from: 'list' | 'map'): void {
    const subject = this.subjectFor(key);
    this.selectedKey.set(key);
    const map = this.map();
    if (!subject) {
      map?.focusFeature(key);
      return;
    }
    const active = document.activeElement;
    this.opener =
      from === 'list' && active instanceof HTMLElement
        ? active
        : this.mapColumn().nativeElement.querySelector<HTMLElement>('.leaflet-container');
    // From the list the map flies to the site; from the map it is already in view and marked.
    if (from === 'list') map?.focusFeature(key);
    this.subject.set(subject);
    this.placeCard();
    afterNextRender(
      () => {
        const docked = this.placement() === 'dock';
        // Opened from the list (a keyboard path), focus follows the profile. Opened by a click on
        // the map, focus stays put; a docked profile scrolls into view instead.
        if (from === 'list') this.profileCard()?.focus(docked);
        else if (docked) this.card().nativeElement.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        this.rail()?.nativeElement.scrollTo({ top: 0 });
      },
      { injector: this.injector },
    );
  }

  /** Close the profile, unmark the site, show the list again, and hand focus back. */
  private endProfile(returnFocus: boolean): void {
    if (!this.subject()) return;
    const card = this.card().nativeElement;
    const hadFocus = card.contains(document.activeElement);
    this.map()?.clearSelection();
    this.dock().nativeElement.append(card);
    this.subject.set(null);
    this.selectedKey.set(null);
    const opener = this.opener;
    this.opener = null;
    if (returnFocus || hadFocus) {
      // The list is shown again on the next render; focus the row once it is.
      afterNextRender(() => {
        if (opener?.isConnected) opener.focus({ preventScroll: true });
      }, { injector: this.injector });
    }
  }

  /** Puts an open profile where the placement says: in the list column, or in the dock under the map. */
  private placeCard(): void {
    if (!this.subject() || !this.viewReady) return;
    const card = this.card().nativeElement;
    const rail = this.rail()?.nativeElement;
    if (this.placement() === 'rail' && rail) rail.append(card);
    else this.dock().nativeElement.append(card);
  }

  /** Drops an open profile without moving focus: a new config, a new pick, or an error. */
  private resetProfile(): void {
    if (this.viewReady) this.dock().nativeElement.append(this.card().nativeElement);
    this.subject.set(null);
    this.opener = null;
  }

  /** The program's site profile settings from its config; null when it has none. */
  private resolveProfile(cfg: SitesPanelConfig): Promise<SiteProfileConfig | null> {
    return Promise.resolve(cfg.siteProfile ?? null);
  }

  protected onPick(event: Event): void {
    const value = (event as CustomEvent<{ value: string | string[] }>).detail?.value;
    const next = Array.isArray(value) ? value[0] : value;
    if (!next || next === this.pickedValue()) return;
    // Back to the value as the service returned it, so a numeric field is compared as a number.
    const picked = this.pickValues.find((v) => String(v) === next) ?? next;
    void this.showAreas(this.config(), this.run, picked);
  }

  protected downloadCsv(): void {
    const file = this.csv?.();
    if (file) download(file.fileName, file.text);
  }

  /* ---------- loading ---------- */

  private setState(state: PanelState): void {
    this.state.set(state);
    if (state !== 'loading') this.settled.emit(state);
  }

  private async start(): Promise<void> {
    const cfg = this.config();
    const run = ++this.run;
    this.pickRun++;
    this.abort?.abort();
    this.areaAbort?.abort();
    const abort = (this.abort = new AbortController());
    const http: FetchLike = (url) => fetch(url, { signal: abort.signal });

    this.layers.set(null);
    this.items.set([]);
    this.groups.set([]);
    this.selectedKey.set(null);
    this.pickOptions.set([]);
    this.picked.set(null);
    this.progress.set(0);
    this.pickValues = [];
    this.csv = null;
    this.resetProfile();
    this.sitesByKey.clear();
    this.areasByKey.clear();
    this.profileConfig.set(cfg.siteProfile ?? null);
    this.profileReady = this.resolveProfile(cfg).then((profile) => {
      if (run === this.run) this.profileConfig.set(profile);
      return profile;
    });

    switch (sitesSourceKind(cfg)) {
      case 'areas':
        await this.loadAreas(cfg, run, http);
        break;
      case 'sites':
        await this.loadSites(cfg, run, http);
        break;
      case 'geojson':
        await this.loadGeoJson(cfg, run, http);
        break;
      default:
        this.setState('empty');
    }
  }

  /** The overlays, each on its own; one that fails is logged and left off rather than failing the panel. */
  private async loadOverlays(cfg: SitesPanelConfig, http: FetchLike): Promise<OverlaySpec[]> {
    const configs = cfg.overlays ?? [];
    const results = await Promise.allSettled(
      configs.map((o) => fetchGeoJson(http, o.layer, overlayQueryParams(o), { service: o.service }).then((f) => overlaySpec(o, f, cfg.program))),
    );
    const out: OverlaySpec[] = [];
    results.forEach((result, i) => {
      if (result.status === 'fulfilled') out.push(result.value);
      else if (!this.abort?.signal.aborted) console.warn(`Overlay layer ${configs[i].layer} did not load: ${String(result.reason)}`);
    });
    return out;
  }

  /** Shows the count of features so far once a layer needs a second request. */
  private onPage(isCurrent: () => boolean): (count: number) => void {
    let pages = 0;
    return (count) => {
      if (++pages > 1 && isCurrent()) this.progress.set(count);
    };
  }

  /* sitesLayer: points collapsed per site, grouped by status */

  private async loadSites(cfg: SitesPanelConfig, run: number, http: FetchLike): Promise<void> {
    const layer = cfg.sitesLayer!;
    const current = () => run === this.run;
    this.setState('loading');
    try {
      // The profile settings arrive with the sites, so the first click already has them.
      const [features, overlays] = await Promise.all([
        fetchGeoJson(http, layer.layer, sitesQueryParams(layer), { service: layer.service, onPage: this.onPage(current) }),
        this.loadOverlays(cfg, http),
        this.profileReady,
      ]);
      if (!current()) return;
      this.showSites(cfg, collapseSites(features, layer), overlays);
    } catch (error) {
      if (!current()) return;
      console.warn(`Sites layer ${layer.layer} did not load: ${String(error)}`);
      this.setState('error');
    }
  }

  /* geojson: sites as a FeatureCollection from one URL */

  private async loadGeoJson(cfg: SitesPanelConfig, run: number, http: FetchLike): Promise<void> {
    const source = cfg.geojson!;
    const current = () => run === this.run;
    this.setState('loading');
    try {
      const [collection, overlays] = await Promise.all([
        http(source.url).then((r) => r.json() as Promise<FeatureCollection | null>),
        this.loadOverlays(cfg, http),
        this.profileReady,
      ]);
      if (!current()) return;
      if (!collection || typeof collection !== 'object') throw new Error('no JSON');
      if (collection.error) throw new Error(collection.error.message || 'GeoJSON request failed');
      const features = Array.isArray(collection.features) ? collection.features : [];
      this.showSites(cfg, collapseSites(features, source), overlays);
    } catch (error) {
      if (!current()) return;
      console.warn(`Sites GeoJSON ${source.url} did not load: ${String(error)}`);
      this.setState('error');
    }
  }

  private showSites(cfg: SitesPanelConfig, sites: Site[], overlays: OverlaySpec[]): void {
    this.progress.set(0);
    if (!sites.length) {
      this.loaded.emit(sitesSummary(cfg, sites));
      this.setState('empty');
      return;
    }
    const fields = cfg.sitesLayer ?? { layer: 0, ...cfg.geojson! };
    const colors = statusColors(sites.map(siteStatus), cfg.color);
    this.siteColors = colors;
    for (const site of sites) this.sitesByKey.set(site.key, site);
    this.layers.set({ program: sitesLayerSpec(fields, sites, colors, cfg.program), overlays });
    this.items.set(siteListItems(sites, colors));
    this.groups.set(siteGroups(sites));
    this.csv = () => ({ fileName: `${slugify(cfg.program)}-sites.csv`, text: sitesCsv(sites) });
    this.loaded.emit(sitesSummary(cfg, sites));
    this.setState('ready');
  }

  /* mapLayer: areas colored by a field, one pick value at a time */

  private async loadAreas(cfg: SitesPanelConfig, run: number, http: FetchLike): Promise<void> {
    const layer = cfg.mapLayer!;
    this.setState('loading');
    this.overlays = this.loadOverlays(cfg, http);
    let choices: (string | number)[] = [];
    if (layer.pick) {
      try {
        choices = pickChoices(await fetchAttributes(http, layer.layer, pickStatsParams(layer), layer.service), layer.pick);
      } catch (error) {
        if (run !== this.run) return;
        console.warn(`Map layer ${layer.layer} pick values did not load: ${String(error)}`);
      }
    }
    if (run !== this.run) return;
    this.pickValues = choices;
    this.pickOptions.set(choices.map((v) => ({ label: String(v), value: String(v) })));
    await this.showAreas(cfg, run, choices[0] ?? null);
  }

  /** Loads and draws the areas for one pick value. A newer pick, or a newer config, makes this one a no-op. */
  private async showAreas(cfg: SitesPanelConfig, run: number, picked: string | number | null): Promise<void> {
    const layer = cfg.mapLayer!;
    const pickRun = ++this.pickRun;
    const current = () => run === this.run && pickRun === this.pickRun;
    this.areaAbort?.abort();
    const abort = (this.areaAbort = new AbortController());
    const http: FetchLike = (url) => fetch(url, { signal: abort.signal });
    this.picked.set(picked);
    this.progress.set(0);
    this.resetProfile();
    this.setState('loading');
    try {
      // The profile's join fields (SEZ_ID) ride along on each area.
      const extra = profileFields(await this.profileReady);
      if (!current()) return;
      const [raw, overlays] = await Promise.all([
        fetchGeoJson(http, layer.layer, areaQueryParams(layer, picked, true, extra), { service: layer.service, onPage: this.onPage(current) }),
        this.overlays,
      ]);
      // A choropleth tags each area with its class; a dot density layer becomes its dots. The map,
      // list, and legend draw what is shown; the CSV and the tiles keep the areas as served.
      const shown = displayLayer(layer);
      const features = prepareAreaFeatures(layer, raw);
      if (!current()) return;
      this.progress.set(0);
      this.selectedKey.set(null);
      this.areasByKey.clear();
      for (const feature of features) this.areasByKey.set(featureKey(feature), feature);
      if (!features.length) {
        this.layers.set(null);
        this.items.set([]);
        this.groups.set([]);
        this.csv = null;
        this.loaded.emit(areasSummary(cfg, raw, picked));
        this.setState('empty');
        return;
      }
      this.layers.set({ program: areasLayerSpec(shown, features, cfg.color, cfg.program), overlays });
      this.items.set(areaListItems(shown, features, cfg.color));
      this.groups.set(areaGroups(shown));
      this.csv = () => areasCsv(layer, raw, picked, cfg.program);
      this.loaded.emit(areasSummary(cfg, raw, picked));
      this.setState('ready');
    } catch (error) {
      if (!current()) return;
      console.warn(`Map layer ${layer.layer} did not load: ${String(error)}`);
      // Nothing from an earlier pick stays on screen under the error.
      this.layers.set(null);
      this.items.set([]);
      this.groups.set([]);
      this.selectedKey.set(null);
      this.csv = null;
      this.progress.set(0);
      this.setState('error');
    }
  }
}
