// The map view options of core Geomap: the view presets and the zoom rules of `initViewExtent`.
// Sources (grafana/grafana main):
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/view.ts
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/GeomapPanel.tsx (`initMapView`)
// The zoom is the OpenLayers zoom level. `lib/echarts/geo/view.ts` changes it to `geo.zoom`.
// Not ported: `shared`, `noRepeat`, `dashboardVariable`, and the layer choice of "Fit to data"
// (`allLayers`, `lastOnly`, `layer`): the fit uses the points that it gets.
import { type MapViewConfig } from '@grafana/schema/dist/esm/raw/composable/geomap/panelcfg/x/GeomapPanelCfg_types.gen';
import { type LonLat } from './gazetteer';

/** The view ids of core that have special rules. */
export const MapCenterID = { Zero: 'zero', Coordinates: 'coords', Fit: 'fit' } as const;

/** One view preset of core `centerPointRegistry`. The editor copies `zoom` into the saved `view.zoom`. */
export interface MapViewPreset {
  id: string;
  name: string;
  lat?: number;
  lon?: number;
  zoom?: number;
}

/** Copy of core `centerPointRegistry`, in the same order. */
export const MAP_VIEW_PRESETS: MapViewPreset[] = [
  { id: MapCenterID.Fit, name: 'Fit to data', zoom: 15 },
  { id: MapCenterID.Zero, name: '(0°, 0°)', lat: 0, lon: 0 },
  { id: MapCenterID.Coordinates, name: 'Coordinates' },
  { id: 'north-america', name: 'North America', lat: 40, lon: -100, zoom: 4 },
  { id: 'south-america', name: 'South America', lat: -20, lon: -60, zoom: 3 },
  { id: 'europe', name: 'Europe', lat: 46, lon: 14, zoom: 4 },
  { id: 'africa', name: 'Africa', lat: 0, lon: 30, zoom: 3 },
  { id: 'west-asia', name: 'West Asia', lat: 26, lon: 53, zoom: 4 },
  { id: 's-asia', name: 'South Asia', lat: 19.5, lon: 80, zoom: 4 },
  { id: 'se-asia', name: 'South-East Asia', lat: 10, lon: 106, zoom: 4 },
  { id: 'e-asia', name: 'East Asia', lat: 33, lon: 120, zoom: 4 },
  { id: 'australia', name: 'Australia', lat: -25, lon: 135, zoom: 4 },
  { id: 'oceania', name: 'Oceania', lat: -10, lon: -140, zoom: 3 },
];

/** The zoom limits of an OpenLayers `View` with no options. https://openlayers.org/en/latest/apidoc/module-ol_View-View.html */
export const OL_MIN_ZOOM = 0;
export const OL_MAX_ZOOM = 28;

/** The view that core shows for a saved `view` option, before the data is known. */
export interface CoreMapView {
  /** The center, or `undefined` for a "Fit to data" view: the data extent gives the center. */
  center?: LonLat;
  /** The OpenLayers zoom level. For a "Fit to data" view, the zoom when the data has no extent. */
  zoom: number;
  minZoom: number;
  maxZoom: number;
  /** Set for a "Fit to data" view. */
  fit?: {
    /** The space around the data extent, in percent of the extent. */
    padding: number;
    /** The largest zoom of the fit: core uses `view.zoom ?? view.maxZoom`. */
    maxZoom?: number;
  };
}

/**
 * Resolve a saved `view` option the same way as core `initMapView` and `initViewExtent`:
 * - The map starts at `[0, 0]`, zoom 1.
 * - A preset with `lat` gives the center. `coords` uses `view.lon` and `view.lat`. An unknown id keeps `[0, 0]`.
 * - `minZoom` and `maxZoom` limit the zoom. `view.zoom` sets the zoom, except for "Fit to data".
 * The preset `zoom` is not used here: the core editor copies it into `view.zoom`.
 */
export function resolveCoreMapView(config: Partial<MapViewConfig> | undefined): CoreMapView {
  const preset = MAP_VIEW_PRESETS.find((p) => p.id === (config?.id ?? MapCenterID.Zero));
  const minZoom = config?.minZoom || OL_MIN_ZOOM;
  const maxZoom = config?.maxZoom || OL_MAX_ZOOM;
  const clamp = (zoom: number) => Math.max(minZoom, Math.min(maxZoom, zoom));
  if (preset?.id === MapCenterID.Fit) {
    return {
      zoom: clamp(1),
      minZoom,
      maxZoom,
      fit: { padding: config?.padding ?? 5, maxZoom: config?.zoom ?? config?.maxZoom },
    };
  }
  let center: LonLat = [0, 0];
  if (preset?.lat != null) {
    center = [preset.lon ?? 0, preset.lat];
  } else if (preset?.id === MapCenterID.Coordinates) {
    center = [config?.lon ?? 0, config?.lat ?? 0];
  }
  return { center, zoom: clamp(config?.zoom || 1), minZoom, maxZoom };
}
