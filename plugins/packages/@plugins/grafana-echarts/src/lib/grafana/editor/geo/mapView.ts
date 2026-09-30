import { type MapViewConfig } from '@grafana/schema/dist/esm/raw/composable/geomap/panelcfg/x/GeomapPanelCfg_types.gen';
import { type GeoInstanceState, MAP_VIEW_PRESETS, MapCenterID, OL_MAX_ZOOM, OL_MIN_ZOOM } from 'lib/grafana/geo/view';

/** The `view` of a new panel, as core `defaultMapViewConfig`. */
export const DEFAULT_MAP_VIEW: MapViewConfig = { id: MapCenterID.Zero, lat: 0, lon: 0, zoom: 1 };

/** The select options of the view presets, in core order. */
export const MAP_VIEW_OPTIONS = MAP_VIEW_PRESETS.map((p) => ({ value: p.id, label: p.name }));

/** The range of the core zoom input. */
export const ZOOM_RANGE = { min: 1, max: 18 };

/** The range of the zoom limit inputs: the zoom limits of OpenLayers. */
export const ZOOM_LIMIT_RANGE = { min: OL_MIN_ZOOM, max: OL_MAX_ZOOM };

/** The view with the saved values of `value` and a default `id`. */
export const resolveMapView = (value: Partial<MapViewConfig> | undefined): MapViewConfig => ({
  ...DEFAULT_MAP_VIEW,
  ...value,
});

/** The inputs that the editor shows for a view: lat and lon for `coords`, the padding for `fit`. */
export function getMapViewFields(view: MapViewConfig) {
  return { coords: view.id === MapCenterID.Coordinates, padding: view.id === MapCenterID.Fit };
}

/**
 * The view after the user selects the preset `id`. As core `onSelectView`, the preset `lat`, `lon` and `zoom`
 * replace the saved values. A preset without them keeps the saved values.
 */
export function selectMapViewPreset(view: MapViewConfig, id: string): MapViewConfig {
  const preset = MAP_VIEW_PRESETS.find((p) => p.id === id);
  if (!preset) {
    return view;
  }
  return {
    ...view,
    id: preset.id,
    lat: preset.lat ?? view.lat,
    lon: preset.lon ?? view.lon,
    zoom: preset.zoom ?? view.zoom,
  };
}

/**
 * The view after "Use current map settings", as core `onSetCurrentView`: the Coordinates view at the live center
 * and zoom. No live view keeps the saved view.
 */
export function applyCurrentMapView(view: MapViewConfig, state: GeoInstanceState | undefined): MapViewConfig {
  const live = state?.readMapView();
  return live ? { ...view, id: MapCenterID.Coordinates, ...live } : view;
}
