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
  output,
  signal,
  untracked,
  viewChild,
  ViewEncapsulation,
} from '@angular/core';
// Types only. The library itself arrives through import() in loadLeaflet(), so a page
// without a map never downloads it.
import type * as Leaflet from 'leaflet';

import type { Feature, LegendEntry, MapLayers, OverlaySpec, PopupCard, ProgramLayerSpec } from '../../lib/sites';

type LeafletModule = typeof Leaflet;

const TOPO_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}';
const IMAGERY_URL = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
const ATTRIBUTION = 'Esri, HERE, Garmin, USGS, NGA, EPA, NPS';
const TAHOE_CENTER: [number, number] = [39.09, -120.04];
const SITE_ZOOM = 13;
/** Above this many features the layers draw on one canvas; thousands of SVG paths make panning slow. */
const CANVAS_THRESHOLD = 2000;
/* Lucide "home", the path the Ecology icon registry ships, inlined because the control is plain DOM. */
const HOME_ICON =
  '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
  '<path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22V12h6v10"/></svg>';

const POINT_STYLE = { radius: 6, color: '#ffffff', weight: 1.5, opacity: 1, fillOpacity: 0.95 };
const SELECTED_POINT_STYLE = { radius: 9, weight: 3 };
/** The outline of a selected area, read from the text color token so it follows the theme. */
const SELECTED_STROKE = 'var(--color-content-default, #333333)';

let leafletPromise: Promise<LeafletModule> | null = null;

/** Leaflet, fetched once on first use. The CommonJS build lands under "default"; an ESM build is the namespace itself. */
function loadLeaflet(): Promise<LeafletModule> {
  leafletPromise ??= import('leaflet').then((mod) => (mod as unknown as { default?: LeafletModule }).default ?? mod);
  return leafletPromise;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, textContent?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (textContent != null) node.textContent = textContent;
  return node;
}

/** The popup card as DOM: title, status or rating pill, stat tiles, label and value rows, and a foot line. */
export function popupElement(card: PopupCard): HTMLElement {
  const root = element('div', 'sites-popup');
  root.append(element('h4', 'sites-popup__title typography-label-md-strong', card.title));
  if (card.pill) {
    const pill = element('span', 'sites-popup__pill typography-label-xs-strong', card.pill.text);
    // The pill color is data: the status or rating color of this feature.
    pill.style.setProperty('--sites-pill', card.pill.color);
    root.append(pill);
  }
  const stats = (card.stats || []).filter(([, value]) => value !== '' && value != null);
  if (stats.length) {
    const grid = element('div', 'sites-popup__stats');
    grid.style.setProperty('--sites-stat-cols', String(Math.min(stats.length, 3)));
    for (const [label, value] of stats) {
      const tile = element('div', 'sites-popup__stat');
      tile.append(
        element('div', 'sites-popup__stat-label typography-body-xs', label),
        element('div', 'sites-popup__stat-value typography-label-md-strong', value),
      );
      grid.append(tile);
    }
    root.append(grid);
  }
  const rows = (card.rows || []).filter(([, value]) => value !== '' && value != null);
  if (rows.length) {
    const list = element('dl', 'sites-popup__rows typography-body-sm');
    for (const [label, value] of rows) {
      const dd = element('dd');
      if (typeof value === 'object') {
        const link = element('a', undefined, value.text);
        link.href = value.href;
        link.target = '_blank';
        link.rel = 'noopener';
        dd.append(link);
      } else {
        dd.textContent = value;
      }
      list.append(element('dt', undefined, label), dd);
    }
    root.append(list);
  }
  if (card.foot) root.append(element('p', 'sites-popup__foot typography-body-xs', card.foot));
  return root;
}

/**
 * The Leaflet map inside the sites panel: World Topo and Aerial basemaps, zoom and Home
 * buttons, the program layer (circle markers, or areas colored by a field), overlays drawn
 * underneath, token-styled popups, and a legend. The wheel never zooms the map, so the page
 * keeps scrolling; drag, touch, the buttons, and the keyboard move it.
 *
 *   <app-sites-map [layers]="layers()" label="Monitoring sites map" (featureSelect)="onPick($event)" />
 *   map.focusFeature(key)   fly to a site or area and open its popup
 *   map.home()              back to the extent of the data
 *
 * With [profiles]="true" the program layer binds no popup of its own. A click only reports the
 * key, and the owner hands back an element to float over the map in one shared popup:
 *   map.openCard(key, el)         float el over the feature (moves the popup when one is open)
 *   map.focusFeature(key, el)     fly there first, then float el
 *   map.closeCard()               close it without firing (cardClosed)
 *   map.zoomTo(key)               zoom in close on a feature
 *   map.clearSelection()          drop the selected style
 * (cardClosed) fires when Leaflet closes the card itself: a click on the map, another popup,
 * or Escape while the map has focus.
 *
 * Styles are global (ViewEncapsulation.None) because Leaflet builds its own DOM, which scoped
 * component styles cannot reach. Every rule is prefixed with .sites-map or .sites-popup.
 */
@Component({
  selector: 'app-sites-map',
  changeDetection: ChangeDetectionStrategy.OnPush,
  encapsulation: ViewEncapsulation.None,
  host: { class: 'sites-map', '[attr.data-features]': 'drawn()', '[class.sites-map--card-open]': 'cardOpen()' },
  template: `
    <div #canvas class="sites-map__canvas" role="region" [attr.aria-label]="label()"></div>
    @if (legend().length) {
      <div class="sites-map__legend" role="group" aria-label="Legend">
        @if (legendTitle()) {
          <p class="sites-map__legend-title typography-label-xs-strong">{{ legendTitle() }}</p>
        }
        <ul class="sites-map__legend-list">
          @for (entry of legend(); track $index) {
            <li class="typography-body-sm">
              <!-- The swatch color is data: the status, rating, or overlay color of that entry. -->
              <i
                [class]="'sites-map__swatch sites-map__swatch--' + entry.shape"
                [style.--sites-swatch]="entry.color"
                aria-hidden="true"
              ></i>
              <span>{{ entry.label }}</span>
            </li>
          }
        </ul>
      </div>
    }
  `,
  styleUrl: './sites-map.scss',
})
export class SitesMap {
  /** The program layer and its overlays, as specs from lib/sites. Setting it redraws the map and refits the view. */
  readonly layers = input<MapLayers | null>(null);
  /** Accessible name of the map region. */
  readonly label = input('Map');
  /** True when the owner shows its own card for a picked feature (the site profile) instead of the popup. */
  readonly profiles = input(false);

  /** The key of the site or area the reader clicked on the map. */
  readonly featureSelect = output<string>();
  /** The floating card was closed by the map itself. */
  readonly cardClosed = output<void>();

  /** How many program features are drawn; mirrored to data-features on the host for tests. */
  protected readonly drawn = signal(0);
  /** The floating card is open; the legend steps aside. */
  protected readonly cardOpen = signal(false);

  protected readonly legend = computed<LegendEntry[]>(() => {
    const layers = this.layers();
    if (!layers) return [];
    return [...layers.program.legend, ...layers.overlays.map((o) => ({ label: o.title, color: o.color, shape: o.geometry }))];
  });
  /** The program layer's title; empty when an entry already says the same thing (an area layer with one color). */
  protected readonly legendTitle = computed(() => {
    const title = this.layers()?.program.title || 'Legend';
    return this.legend().some((entry) => entry.label === title) ? '' : title;
  });

  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly canvas = viewChild.required<ElementRef<HTMLDivElement>>('canvas');
  /** Set once the map exists, so the draw effect runs after Leaflet has loaded. */
  private readonly leaflet = signal<LeafletModule | null>(null);

  private map: Leaflet.Map | null = null;
  private overlayGroup: Leaflet.LayerGroup | null = null;
  private programGroup: Leaflet.LayerGroup | null = null;
  private svgRenderer: Leaflet.Renderer | null = null;
  private canvasRenderer: Leaflet.Renderer | null = null;
  private readonly byKey = new Map<string, Leaflet.Layer>();
  private readonly baseStyle = new Map<Leaflet.Layer, Leaflet.PathOptions>();
  private selected: Leaflet.Layer | null = null;
  private bounds: Leaflet.LatLngBounds | null = null;
  private resize: ResizeObserver | null = null;
  private readonly colorCache = new Map<string, string>();
  /** True when a fit was asked for while the container had no size; the next resize does it. */
  private fitPending = false;
  private popupTimer = 0;
  private destroyed = false;
  /** The one popup the profile card floats in. */
  private card: Leaflet.Popup | null = null;
  /** Set while this component closes the card itself, so (cardClosed) does not fire. */
  private closingCard = false;
  /** Where the reader last clicked an area, so its card opens there rather than at the area's center. */
  private lastClick: { key: string; latlng: Leaflet.LatLng } | null = null;

  constructor() {
    afterNextRender(() => void this.init());
    effect(() => {
      const L = this.leaflet();
      const layers = this.layers();
      if (L) untracked(() => this.render(L, layers));
    });
    inject(DestroyRef).onDestroy(() => this.destroy());
  }

  /**
   * Fly to a site or area by its key, mark it selected, and open its popup. With profiles on,
   * the card element given floats there instead; with no element the map only moves.
   */
  focusFeature(key: string, card: HTMLElement | null = null, onOpen?: () => void): void {
    const L = this.leaflet();
    const map = this.map;
    const layer = this.byKey.get(key);
    if (!L || !map || !layer) return;
    const still = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.host.scrollIntoView({ block: 'nearest', behavior: still ? 'auto' : 'smooth' });
    this.highlight(L, layer);
    this.lastClick = null;
    if (this.profiles()) this.closeCard();
    else map.closePopup();
    let opened = false;
    const open = () => {
      if (opened || this.map !== map) return;
      opened = true;
      map.off('moveend', open);
      if (!this.profiles()) layer.openPopup();
      else if (card) this.openCard(key, card);
      onOpen?.();
    };
    map.once('moveend', open);
    window.clearTimeout(this.popupTimer);
    if (layer instanceof L.CircleMarker) {
      const zoom = Math.max(map.getZoom(), SITE_ZOOM);
      if (still) map.setView(layer.getLatLng(), zoom, { animate: false });
      else map.flyTo(layer.getLatLng(), zoom, { duration: 0.6 });
    } else if (layer instanceof L.Polyline) {
      const bounds = layer.getBounds();
      if (!bounds.isValid()) {
        open();
        return;
      }
      if (still) map.fitBounds(bounds.pad(0.6), { maxZoom: 16, animate: false });
      else map.flyToBounds(bounds.pad(0.6), { duration: 0.6, maxZoom: 16 });
    } else {
      open();
      return;
    }
    // A move that ends where it started may not fire moveend, so open the popup after the animation anyway.
    this.popupTimer = window.setTimeout(open, 900);
  }

  /** Float the card over a feature in the shared popup, or move the open popup to it. */
  openCard(key: string, content: HTMLElement): void {
    const L = this.leaflet();
    const map = this.map;
    const layer = this.byKey.get(key);
    if (!L || !map || !layer) return;
    this.highlight(L, layer);
    let at: Leaflet.LatLng;
    if (layer instanceof L.CircleMarker) at = layer.getLatLng();
    else if (this.lastClick?.key === key) at = this.lastClick.latlng;
    else if (layer instanceof L.Polyline && layer.getBounds().isValid()) at = layer.getBounds().getCenter();
    else at = map.getCenter();
    if (!this.card) {
      this.card = L.popup({
        className: 'sites-map__card',
        maxWidth: 360,
        minWidth: 360,
        closeButton: false,
        autoPan: true,
        autoPanPadding: L.point(16, 16),
        closeOnEscapeKey: true,
      });
      this.card.on('add', () => this.cardOpen.set(true));
      this.card.on('remove', () => {
        this.cardOpen.set(false);
        if (!this.closingCard) this.cardClosed.emit();
      });
    }
    // A marker's card sits just above the marker; an area's at the point itself.
    this.card.options.offset = layer instanceof L.CircleMarker ? L.point(0, -4) : L.point(0, 4);
    if (this.card.isOpen()) {
      this.card.setLatLng(at);
      if (this.card.getContent() !== content) this.card.setContent(content);
      this.panCardIntoView();
    } else {
      this.card.setLatLng(at).setContent(content).openOn(map);
    }
  }

  /** Close the floating card without firing (cardClosed). */
  closeCard(): void {
    if (!this.card?.isOpen()) return;
    this.closingCard = true;
    try {
      this.card.close();
    } finally {
      this.closingCard = false;
    }
  }

  /** The card changed size: keep it inside the map. */
  panCardIntoView(): void {
    const card = this.card as (Leaflet.Popup & { _adjustPan?: () => void; _updatePosition?: () => void }) | null;
    if (!card?.isOpen()) return;
    // Leaflet keeps both private; they are what update() runs, without setting the content again,
    // which would move the card's DOM and drop the focus inside it.
    card._updatePosition?.();
    card._adjustPan?.();
  }

  /** Zoom in close on a site, or fit an area; the card stays on it. */
  zoomTo(key: string): void {
    const L = this.leaflet();
    const map = this.map;
    const layer = this.byKey.get(key);
    if (!L || !map || !layer) return;
    const animate = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (layer instanceof L.CircleMarker) {
      map.setView(layer.getLatLng(), Math.max(map.getZoom() + 1, 16), { animate });
    } else if (layer instanceof L.Polyline && layer.getBounds().isValid()) {
      map.fitBounds(layer.getBounds(), { padding: [48, 48], maxZoom: 17, animate });
    }
  }

  /** Put the selected feature back to its drawn style. */
  clearSelection(): void {
    const L = this.leaflet();
    if (!L || !this.selected) return;
    this.restore(L, this.selected);
    this.selected = null;
  }

  /** Refit the view to the program layer, as the Home button does. */
  home(animate: boolean = true): void {
    const map = this.map;
    if (!map) return;
    const size = map.getSize();
    if (!size.x || !size.y) {
      this.fitPending = true;
      return;
    }
    this.fitPending = false;
    const move = animate && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const bounds = this.bounds;
    if (!bounds || !bounds.isValid()) {
      map.setView(TAHOE_CENTER, 10, { animate: move });
      return;
    }
    if (bounds.getNorthEast().equals(bounds.getSouthWest())) {
      map.setView(bounds.getCenter(), SITE_ZOOM, { animate: move });
      return;
    }
    map.fitBounds(bounds, { padding: [24, 24], maxZoom: 15, animate: move });
  }

  private async init(): Promise<void> {
    let L: LeafletModule;
    try {
      L = await loadLeaflet();
    } catch (error) {
      console.error(`The map library did not load: ${String(error)}`);
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
    const topo = new SeamlessTiles(TOPO_URL, { attribution: ATTRIBUTION, maxZoom: 19 });
    const aerial = new SeamlessTiles(IMAGERY_URL, { attribution: ATTRIBUTION, maxZoom: 19 });
    const map = L.map(this.canvas().nativeElement, {
      center: TAHOE_CENTER,
      zoom: 10,
      layers: [topo],
      // The wheel scrolls the page, never the map.
      scrollWheelZoom: false,
      // Quarter steps let the fit fill the frame, which matters most on a phone, where a whole
      // level down halves the data. The buttons still move a whole level.
      zoomSnap: 0.25,
      zoomDelta: 1,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      zoomControl: true,
      attributionControl: true,
    });
    L.control.layers({ Topographic: topo, Aerial: aerial }, undefined, { position: 'topright', collapsed: true }).addTo(map);
    this.svgRenderer = L.svg({ padding: 0.5 });
    this.canvasRenderer = L.canvas({ padding: 0.5 });
    this.overlayGroup = L.layerGroup().addTo(map);
    this.programGroup = L.layerGroup().addTo(map);

    const HomeControl = L.Control.extend({
      onAdd: () => {
        const bar = L.DomUtil.create('div', 'leaflet-bar sites-map__home');
        const button = L.DomUtil.create('button', 'sites-map__home-button', bar) as HTMLButtonElement;
        button.type = 'button';
        button.title = 'Zoom to all';
        button.setAttribute('aria-label', 'Zoom to all features');
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

    this.map = map;
    // The container changes size when the panel stacks, a tab shows, or fonts land; without this
    // Leaflet keeps the old size and leaves gray bands.
    this.resize = new ResizeObserver(() => {
      map.invalidateSize({ animate: false });
      if (this.fitPending) this.home(false);
    });
    this.resize.observe(this.canvas().nativeElement);
    this.leaflet.set(L);
  }

  private destroy(): void {
    this.destroyed = true;
    this.closeCard();
    this.card = null;
    window.clearTimeout(this.popupTimer);
    this.resize?.disconnect();
    this.resize = null;
    this.map?.remove();
    this.map = null;
    this.overlayGroup = null;
    this.programGroup = null;
    this.byKey.clear();
    this.baseStyle.clear();
    this.selected = null;
  }

  /** A CSS color Leaflet can use. Token expressions such as var(--x, #fallback) resolve through a probe element. */
  private resolveColor(value: string): string {
    if (!value) return '#8d8d8d';
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

  private render(L: LeafletModule, layers: MapLayers | null): void {
    const map = this.map;
    const overlays = this.overlayGroup;
    const program = this.programGroup;
    if (!map || !overlays || !program) return;
    window.clearTimeout(this.popupTimer);
    this.closeCard();
    map.closePopup();
    this.lastClick = null;
    overlays.clearLayers();
    program.clearLayers();
    this.byKey.clear();
    this.baseStyle.clear();
    this.selected = null;
    this.bounds = null;
    this.drawn.set(0);
    if (!layers) return;
    const total = layers.program.features.length + layers.overlays.reduce((sum, o) => sum + o.features.length, 0);
    // One renderer for everything in a draw: a canvas above an SVG would swallow the clicks meant for it.
    const renderer = (total > CANVAS_THRESHOLD ? this.canvasRenderer : this.svgRenderer) as Leaflet.Renderer;
    for (const overlay of layers.overlays) this.addOverlay(L, overlay, renderer);
    const drawn = this.addProgram(L, layers.program, renderer);
    const bounds = drawn.getBounds();
    if (bounds.isValid()) this.bounds = bounds;
    this.drawn.set(this.byKey.size);
    this.home(false);
  }

  private addProgram(L: LeafletModule, spec: ProgramLayerSpec, renderer: Leaflet.Renderer): Leaflet.GeoJSON {
    const options: Leaflet.GeoJSONOptions & { renderer: Leaflet.Renderer } = {
      renderer,
      pointToLayer: (feature, latlng) =>
        L.circleMarker(latlng, { ...POINT_STYLE, renderer, fillColor: this.resolveColor(spec.color(feature as unknown as Feature)) }),
      style: (feature) => {
        const color = this.resolveColor(spec.color(feature as unknown as Feature));
        return spec.geometry === 'line'
          ? { color, weight: 3, opacity: 0.95 }
          : { color, weight: 1, opacity: 0.9, fillColor: color, fillOpacity: 0.55 };
      },
      onEachFeature: (feature, drawn) => {
        const typed = feature as unknown as Feature;
        const key = spec.key(typed);
        this.byKey.set(key, drawn);
        if (!this.profiles()) {
          drawn.bindPopup(() => popupElement(spec.popup(typed)), { maxWidth: 320, autoPanPadding: [24, 24] });
        }
        drawn.on('click', (event: Leaflet.LeafletMouseEvent) => {
          this.lastClick = event.latlng ? { key, latlng: event.latlng } : null;
          this.highlight(L, drawn);
          this.featureSelect.emit(key);
        });
      },
    };
    const collection = { type: 'FeatureCollection', features: spec.features } as unknown as Parameters<typeof L.geoJSON>[0];
    const layer = L.geoJSON(collection, options);
    this.programGroup?.addLayer(layer);
    return layer;
  }

  private addOverlay(L: LeafletModule, spec: OverlaySpec, renderer: Leaflet.Renderer): void {
    const color = this.resolveColor(spec.color);
    const options: Leaflet.GeoJSONOptions & { renderer: Leaflet.Renderer } = {
      renderer,
      pointToLayer: (_feature, latlng) =>
        L.circleMarker(latlng, { radius: 5, color: '#ffffff', weight: 1, fillColor: color, fillOpacity: 0.9, renderer }),
      style: () =>
        spec.geometry === 'line'
          ? { color, weight: 2, opacity: 0.9 }
          : { color, weight: 1, opacity: 0.9, fillColor: color, fillOpacity: 0.25 },
      onEachFeature: (feature, drawn) => {
        drawn.bindPopup(() => popupElement(spec.popup(feature as unknown as Feature)), { maxWidth: 320, autoPanPadding: [24, 24] });
      },
    };
    const collection = { type: 'FeatureCollection', features: spec.features } as unknown as Parameters<typeof L.geoJSON>[0];
    const layer = L.geoJSON(collection, options);
    this.overlayGroup?.addLayer(layer);
    // Overlays are reference layers: keep them under the program layer whatever the add order.
    layer.bringToBack();
  }

  /** Put a feature back to the style it was drawn with. */
  private restore(L: LeafletModule, layer: Leaflet.Layer | null): void {
    if (!layer) return;
    if (layer instanceof L.CircleMarker) {
      layer.setStyle({ radius: POINT_STYLE.radius, weight: POINT_STYLE.weight });
    } else if (layer instanceof L.Path) {
      const base = this.baseStyle.get(layer);
      if (base) layer.setStyle(base);
    }
  }

  private highlight(L: LeafletModule, layer: Leaflet.Layer): void {
    if (this.selected && this.selected !== layer) this.restore(L, this.selected);
    this.selected = layer;
    if (layer instanceof L.CircleMarker) {
      layer.setStyle(SELECTED_POINT_STYLE);
      layer.bringToFront();
    } else if (layer instanceof L.Path) {
      if (!this.baseStyle.has(layer)) {
        const { color, weight, opacity, fillOpacity } = layer.options;
        this.baseStyle.set(layer, { color, weight, opacity, fillOpacity });
      }
      const line = this.layers()?.program.geometry === 'line';
      layer.setStyle(
        line ? { weight: 6, opacity: 1 } : { color: this.resolveColor(SELECTED_STROKE), weight: 2.5, opacity: 1, fillOpacity: 0.75 },
      );
      layer.bringToFront();
    }
  }
}
