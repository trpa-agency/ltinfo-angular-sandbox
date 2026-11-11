import type * as Leaflet from 'leaflet';

/**
 * The basemaps every map in the app offers. The default is a light gray base over Esri's
 * hillshade: quiet enough that data color reads first (Ecology: grayscale basemaps), with the
 * Basin's terrain still visible. Topographic and Aerial stay one click away.
 */

const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services';
const HILLSHADE_URL = `${ESRI}/Elevation/World_Hillshade/MapServer/tile/{z}/{y}/{x}`;
const GRAY_BASE_URL = `${ESRI}/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`;
const GRAY_LABELS_URL = `${ESRI}/Canvas/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}`;
const TOPO_URL = `${ESRI}/World_Topo_Map/MapServer/tile/{z}/{y}/{x}`;
const IMAGERY_URL = `${ESRI}/World_Imagery/MapServer/tile/{z}/{y}/{x}`;
export const BASEMAP_ATTRIBUTION = 'Esri, HERE, Garmin, USGS, NGA, EPA, NPS';

/** How much of the gray base covers the hillshade: lower shows more relief. */
const GRAY_OVER_TERRAIN_OPACITY = 0.62;

export type TileLayerClass = new (url: string, options: Leaflet.TileLayerOptions) => Leaflet.TileLayer;

export interface Basemaps {
  /** The default, already in the order it draws: hillshade, gray base, labels. */
  terrain: Leaflet.LayerGroup;
  topo: Leaflet.TileLayer;
  aerial: Leaflet.TileLayer;
  /** For L.control.layers. */
  choices: Record<string, Leaflet.Layer>;
}

/**
 * Builds the three basemaps with the map's own tile class (the maps use a subclass that
 * closes the hairline seams at fractional zoom).
 */
export function createBasemaps(L: typeof Leaflet, Tiles: TileLayerClass): Basemaps {
  const shared = { attribution: BASEMAP_ATTRIBUTION, maxZoom: 19 };
  // The gray canvas and hillshade stop at level 16; above that Leaflet stretches the level 16 tiles.
  const terrain = L.layerGroup([
    new Tiles(HILLSHADE_URL, { ...shared, maxNativeZoom: 16 }),
    new Tiles(GRAY_BASE_URL, { ...shared, maxNativeZoom: 16, opacity: GRAY_OVER_TERRAIN_OPACITY }),
    new Tiles(GRAY_LABELS_URL, { ...shared, maxNativeZoom: 16 }),
  ]);
  const topo = new Tiles(TOPO_URL, shared);
  const aerial = new Tiles(IMAGERY_URL, shared);
  return { terrain, topo, aerial, choices: { 'Light gray terrain': terrain, Topographic: topo, Aerial: aerial } };
}
