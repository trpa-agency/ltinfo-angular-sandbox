import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
// Types only. The library arrives through import() in loadLeaflet(), so the home page
// bundle stays small and the map code downloads after the cards are on screen.
import type * as Leaflet from 'leaflet';

import type { MonitoringProgramSummary, MonitoringSite } from '../../api/models';
import { SandboxApiService } from '../../api/sandbox-api.service';
import { categoryColor } from './home-model';

type LeafletModule = typeof Leaflet;
export type HomeMapState = 'loading' | 'ready' | 'error';

const GRAY_URL =
  'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}';
const TOPO_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
const IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = 'Esri, HERE, Garmin, USGS, NGA, EPA, NPS';
const TAHOE_CENTER: [number, number] = [39.09, -120.04];
/* Lucide "home", the path the Ecology icon registry ships, inlined because the control is plain DOM. */
const HOME_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>';

/** Sizes and weights of a site in color and a site grayed out. Colors come from data and tokens. */
const ON_STYLE = { radius: 5, weight: 1, opacity: 1, fillOpacity: 0.95 };
const OFF_STYLE = { radius: 3.5, weight: 0.5, opacity: 0.4, fillOpacity: 0.35 };
/** Token expressions resolved at runtime, since Leaflet draws on a canvas that cannot read CSS. */
const GRAY_TOKEN = 'var(--color-gray-8)';
const OUTLINE_TOKEN = 'var(--color-background-elevation-raised)';

const KIND_NOTE: Record<MonitoringSite['SiteKind'], string> = {
  site: '',
  area: 'One point stands for this mapped area. The program page draws its full shape.',
  line: 'One point stands for this mapped line. The program page draws its full shape.',
};

let leafletPromise: Promise<LeafletModule> | null = null;

/** Leaflet, fetched once on first use. The CommonJS build lands under "default"; an ESM build is the namespace itself. */
function loadLeaflet(): Promise<LeafletModule> {
  leafletPromise ??= import('leaflet').then((mod) => (mod as unknown as { default?: LeafletModule }).default ?? mod);
  return leafletPromise;
}

/**
 * The extent of the middle 98 percent of sites on each axis, so a few far-off points do not
 * shrink the basin in the first view. Home goes back to this; the reader can still pan out.
 */
function coreBounds(L: LeafletModule, sites: readonly MonitoringSite[]): Leaflet.LatLngBounds | null {
  if (sites.length < 2) return null;
  const pick = (values: number[], share: number): number => values[Math.min(values.length - 1, Math.floor(share * values.length))];
  const lats = sites.map((site) => site.Latitude).sort((a, b) => a - b);
  const lngs = sites.map((site) => site.Longitude).sort((a, b) => a - b);
  return L.latLngBounds([pick(lats, 0.01), pick(lngs, 0.01)], [pick(lats, 0.99), pick(lngs, 0.99)]);
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

/**
 * Every monitoring site on one Leaflet map, each in its category color. The page sets
 * [focus] to the programs whose sites stay in color; every other site turns gray. Only
 * colors change: the view stays where the reader left it.
 *
 *   <app-home-map [programs]="programs()" [focus]="focusIds()" />
 *
 * For tests the host carries data-state (loading, ready, or error), data-points (sites
 * drawn), and data-highlighted (sites in color).
 *
 * Styles are global (ViewEncapsulation.None) because Leaflet builds its own DOM, which scoped
 * styles cannot reach. Every rule is prefixed with .home-map or .home-popup.
 */
@Component({
  selector: 'app-home-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: {
    class: 'home-map',
    '[attr.data-state]': 'state()',
    '[attr.data-points]': 'points()',
    '[attr.data-highlighted]': 'highlighted()',
  },
  template: `
    <div #canvas class="home-map__canvas" role="region" [attr.aria-label]="label()"></div>
    @if (state() === 'loading') {
      <p class="home-map__note typography-body-sm" role="status">Loading the monitoring sites.</p>
    } @else if (state() === 'error') {
      <p class="home-map__note typography-body-sm" role="alert">
        The monitoring sites could not be loaded. The categories and programs still work.
      </p>
    }
  `,
  styleUrl: './home-map.scss',
})
export class HomeMap {
  /** Every program, for each site's color, name, and category. */
  readonly programs = input.required<readonly MonitoringProgramSummary[]>();
  /** Programs whose sites are in color; null colors every site. */
  readonly focus = input<ReadonlySet<number> | null>(null);
  readonly label = input('Map of monitoring sites');

  protected readonly state = signal<HomeMapState>('loading');
  protected readonly points = signal(0);
  protected readonly highlighted = signal(0);

  private readonly api = inject(SandboxApiService);
  private readonly router = inject(Router);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('canvas');
  private readonly byProgram = computed(
    () => new Map(this.programs().map((program) => [program.MonitoringProgramID, program])),
  );
  /** Set once the markers are drawn, so the color effect runs after Leaflet has loaded. */
  private readonly leaflet = signal<LeafletModule | null>(null);

  private map: Leaflet.Map | null = null;
  private markers: { marker: Leaflet.CircleMarker; programId: number; on: boolean | null }[] = [];
  private bounds: Leaflet.LatLngBounds | null = null;
  private resize: ResizeObserver | null = null;
  private destroyed = false;

  constructor() {
    afterNextRender(() => void this.init());
    effect(() => {
      const L = this.leaflet();
      const focus = this.focus();
      if (L) untracked(() => this.recolor(focus));
    });
    inject(DestroyRef).onDestroy(() => this.destroy());
  }

  /** Back to the extent of every site, as the Home button does. */
  home(animate = true): void {
    const map = this.map;
    if (!map) return;
    const move = animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (this.bounds?.isValid()) map.fitBounds(this.bounds, { padding: [16, 16], animate: move });
    else map.setView(TAHOE_CENTER, 10, { animate: move });
  }

  private async init(): Promise<void> {
    let L: LeafletModule;
    let sites: MonitoringSite[];
    try {
      [L, sites] = await Promise.all([loadLeaflet(), firstValueFrom(this.api.getSites())]);
    } catch {
      // The page's own empty state says what happened; the browser has already logged the request.
      if (!this.destroyed) this.state.set('error');
      return;
    }
    if (this.destroyed) return;

    // At a fractional zoom the browser rounds each scaled tile separately and hairlines show
    // between them. Tiles one pixel larger overlap their neighbors and close the gaps.
    const SeamlessTiles = L.TileLayer.extend({
      _initTile(this: Leaflet.TileLayer, tile: HTMLElement) {
        (L.TileLayer.prototype as unknown as { _initTile(tile: HTMLElement): void })._initTile.call(this, tile);
        const size = this.getTileSize();
        tile.style.width = `${size.x + 1}px`;
        tile.style.height = `${size.y + 1}px`;
      },
    }) as unknown as new (url: string, options: Leaflet.TileLayerOptions) => Leaflet.TileLayer;
    // Light gray first: category colors read best on a quiet base, as on the live page.
    const gray = new SeamlessTiles(GRAY_URL, { attribution: ATTRIBUTION, maxZoom: 16 });
    const topo = new SeamlessTiles(TOPO_URL, { attribution: ATTRIBUTION, maxZoom: 19 });
    const aerial = new SeamlessTiles(IMAGERY_URL, { attribution: ATTRIBUTION, maxZoom: 19 });
    const map = L.map(this.canvas().nativeElement, {
      center: TAHOE_CENTER,
      zoom: 10,
      layers: [gray],
      // The wheel scrolls the page, never the map.
      scrollWheelZoom: false,
      zoomSnap: 0.25,
      zoomDelta: 1,
    });
    L.control
      .layers({ 'Light gray': gray, Topographic: topo, Aerial: aerial }, undefined, { position: 'topright', collapsed: true })
      .addTo(map);

    const HomeControl = L.Control.extend({
      onAdd: () => {
        const bar = L.DomUtil.create('div', 'leaflet-bar home-map__home');
        const button = L.DomUtil.create('button', 'home-map__home-button', bar) as HTMLButtonElement;
        button.type = 'button';
        button.title = 'Zoom to all sites';
        button.setAttribute('aria-label', 'Zoom to all sites');
        button.innerHTML = HOME_ICON;
        L.DomEvent.disableClickPropagation(bar);
        L.DomEvent.on(button, 'click', (event: Event) => {
          L.DomEvent.stop(event);
          this.home();
        });
        return bar;
      },
    });
    new HomeControl({ position: 'topleft' }).addTo(map);

    // 1,750 points: one canvas instead of 1,750 SVG paths.
    const renderer = L.canvas({ padding: 0.5 });
    const outline = this.resolveColor(OUTLINE_TOKEN);
    const group = L.featureGroup().addTo(map);
    const programs = this.byProgram();
    for (const site of sites) {
      const program = programs.get(site.MonitoringProgramID);
      const marker = L.circleMarker([site.Latitude, site.Longitude], {
        ...ON_STYLE,
        renderer,
        color: outline,
        fillColor: this.resolveColor(program ? categoryColor(program) : GRAY_TOKEN),
      });
      marker.bindPopup(() => this.popup(site), { maxWidth: 280, autoPanPadding: [16, 16] });
      group.addLayer(marker);
      this.markers.push({ marker, programId: site.MonitoringProgramID, on: null });
    }
    this.bounds = coreBounds(L, sites) ?? group.getBounds();
    this.map = map;
    this.home(false);

    // The container changes size when the layout stacks or fonts land; without this Leaflet
    // keeps the old size and leaves gray bands.
    this.resize = new ResizeObserver(() => map.invalidateSize({ animate: false }));
    this.resize.observe(this.canvas().nativeElement);

    this.points.set(this.markers.length);
    this.leaflet.set(L);
    this.state.set('ready');
  }

  /** Sites of focused programs in their category color and on top; the rest gray. */
  private recolor(focus: ReadonlySet<number> | null): void {
    const gray = this.resolveColor(GRAY_TOKEN);
    const programs = this.byProgram();
    let count = 0;
    const raise: Leaflet.CircleMarker[] = [];
    for (const entry of this.markers) {
      const on = !focus || focus.has(entry.programId);
      if (on) count += 1;
      if (entry.on === on) continue;
      entry.on = on;
      const program = programs.get(entry.programId);
      const color = program ? this.resolveColor(categoryColor(program)) : gray;
      entry.marker.setStyle(on ? { ...ON_STYLE, fillColor: color } : { ...OFF_STYLE, fillColor: gray });
      if (on) raise.push(entry.marker);
    }
    for (const marker of raise) marker.bringToFront();
    this.highlighted.set(count);
  }

  /** The popup: site name, the program as a link inside the app, and the category. */
  private popup(site: MonitoringSite): HTMLElement {
    const program = this.byProgram().get(site.MonitoringProgramID);
    const root = element('div', 'home-popup');
    root.append(element('h3', 'home-popup__title typography-label-md-strong', site.SiteName || 'Monitoring site'));
    const rows = element('dl', 'home-popup__rows typography-body-sm');
    const programCell = element('dd');
    if (program) {
      const href = `/programs/${program.MonitoringProgramID}`;
      const link = element('a', undefined, program.MonitoringProgramName);
      link.href = href;
      // A route change, not a page load.
      link.addEventListener('click', (event) => {
        if (event.ctrlKey || event.metaKey || event.shiftKey || event.button !== 0) return;
        event.preventDefault();
        void this.router.navigateByUrl(href);
      });
      programCell.append(link);
    } else {
      programCell.textContent = 'Unknown program';
    }
    const categoryCell = element('dd');
    const category = element('span', 'home-popup__category', program?.CategoryName ?? 'Unknown');
    if (program) category.style.setProperty('--home-popup-color', categoryColor(program));
    categoryCell.append(category);
    rows.append(element('dt', undefined, 'Program'), programCell, element('dt', undefined, 'Category'), categoryCell);
    root.append(rows);
    if (KIND_NOTE[site.SiteKind]) root.append(element('p', 'home-popup__foot typography-body-xs', KIND_NOTE[site.SiteKind]));
    return root;
  }

  private readonly colorCache = new Map<string, string>();

  /** A CSS color Leaflet can use; token expressions resolve through a hidden probe element. */
  private resolveColor(value: string): string {
    if (!value.includes('var(')) return value;
    const cached = this.colorCache.get(value);
    if (cached) return cached;
    const probe = element('span');
    probe.hidden = true;
    probe.style.color = value;
    this.host.append(probe);
    const resolved = getComputedStyle(probe).color || value;
    probe.remove();
    this.colorCache.set(value, resolved);
    return resolved;
  }

  private destroy(): void {
    this.destroyed = true;
    this.resize?.disconnect();
    this.resize = null;
    this.map?.remove();
    this.map = null;
    this.markers = [];
  }
}
