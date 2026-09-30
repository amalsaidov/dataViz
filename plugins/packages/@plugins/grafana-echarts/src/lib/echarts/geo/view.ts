import { type GeoComponentOption } from 'echarts';
import { type LonLat } from 'lib/grafana/geo/gazetteer';
import { type CoreMapView, type LiveMapView } from 'lib/grafana/geo/view';
import { type GeoViewState } from './liveView';
import { projectLonLat, unprojectLonLat, WORLD_LAYOUT } from './projection';

/** The tile size of OpenLayers: at zoom 0 the world is 256 px wide. https://openlayers.org/en/latest/apidoc/module-ol_View-View.html */
const OL_TILE_SIZE = 256;

/** The panel size in px. */
export interface ViewSize {
  width: number;
  height: number;
}

/**
 * Change an OpenLayers zoom level to `geo.zoom`. At OpenLayers zoom `z` the world is `256 * 2^z` px wide.
 * With `WORLD_BOUNDING_COORDS` and `WORLD_LAYOUT`, `geo.zoom: 1` fits the world square in `min(width, height)` px.
 * https://echarts.apache.org/en/option.html#geo.zoom
 */
export function toGeoZoom(olZoom: number, size: ViewSize): number {
  return (OL_TILE_SIZE * 2 ** olZoom) / Math.min(size.width, size.height);
}

/** The inverse of `toGeoZoom`. */
export function fromGeoZoom(geoZoom: number, size: ViewSize): number {
  return Math.log2((geoZoom * Math.min(size.width, size.height)) / OL_TILE_SIZE);
}

/**
 * The live `geo` view in core terms, as core `onSetCurrentView`: the center in degrees with 6 decimals, and the
 * OpenLayers zoom with 2 decimals. A view with no center or zoom, or a chart with no size, gives `undefined`.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/editor/MapViewEditor.tsx
 */
export function toLiveMapView(view: GeoViewState | undefined, size: ViewSize): LiveMapView | undefined {
  if (!view?.center || view.zoom == null || !(Math.min(size.width, size.height) > 0)) {
    return undefined;
  }
  const [lon, lat] = unprojectLonLat(view.center);
  const round = (value: number, digits: number) => +value.toFixed(digits);
  return { lon: round(lon, 6), lat: round(lat, 6), zoom: round(fromGeoZoom(view.zoom, size), 2) };
}

/**
 * The OpenLayers zoom that shows the data like core "Fit to data": fit the extent, add `padding` percent,
 * then limit to the fit `maxZoom` and the view limits. No finite point gives `undefined`.
 * Core: `initViewExtent` in https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/GeomapPanel.tsx
 */
function fitView(view: CoreMapView, points: LonLat[], size: ViewSize): { center: number[]; zoom: number } | undefined {
  const projected = points.filter((p) => Number.isFinite(p[0]) && Number.isFinite(p[1])).map(projectLonLat);
  if (!projected.length || !view.fit) {
    return undefined;
  }
  const xs = projected.map((p) => p[0]);
  const ys = projected.map((p) => p[1]);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  // World units per px. One point has no extent: the fit then stops at the largest zoom.
  const resolution = Math.max((maxX - minX) / size.width, (maxY - minY) / size.height) * (1 + view.fit.padding / 100);
  const fitMax = Math.min(view.fit.maxZoom ?? view.maxZoom, view.maxZoom);
  const zoom = resolution > 0 ? Math.log2(1 / (OL_TILE_SIZE * resolution)) : fitMax;
  return { center: [(minX + maxX) / 2, (minY + maxY) / 2], zoom: Math.max(view.minZoom, Math.min(fitMax, zoom)) };
}

/**
 * The `geo.center` (projected, see `webMercator`) and `geo.zoom` of a core map view, with `WORLD_LAYOUT`,
 * which the zoom needs. `points` are the data positions, for a "Fit to data" view only.
 */
export function toGeoView(
  view: CoreMapView,
  size: ViewSize,
  points: LonLat[] = []
): Pick<GeoComponentOption, 'center' | 'zoom' | 'layoutCenter' | 'layoutSize'> {
  const fitted = view.fit ? fitView(view, points, size) : undefined;
  const center = fitted?.center ?? projectLonLat(view.center ?? [0, 0]);
  return { ...WORLD_LAYOUT, center, zoom: toGeoZoom(fitted?.zoom ?? view.zoom, size) };
}
