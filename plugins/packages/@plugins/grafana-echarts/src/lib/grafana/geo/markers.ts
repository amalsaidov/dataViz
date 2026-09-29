// The markers of the core Geomap markers layer.
// Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/markersLayer.tsx
// and `initLayers` in https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/GeomapPanel.tsx
import { type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import {
  getMarkerLayerStyle,
  getMarkerValues,
  type MarkerLayerStyle,
  type MarkerStyleConfig,
  type MarkerValues,
} from './dimensions';
import { type LonLat } from './gazetteer';
import { getLayerFrames, MARKERS_LAYER_TYPE, resolveLayers } from './layers';
import { getFramePositions, getLocationMatchers } from './location';

/** One marker: the position and the values of its row. */
export interface GeoMarker extends MarkerValues {
  lonLat: LonLat;
  /** The row of the marker in `GeoMarkers.frame`. */
  rowIndex: number;
}

/** The markers of a layer, and the style that all of them share. */
export interface GeoMarkers {
  markers: GeoMarker[];
  style: MarkerLayerStyle;
  /** The frame of the markers. */
  frame?: DataFrame;
  /** The layer shows a tooltip: core layer option `tooltip`, true when unset. */
  tooltip: boolean;
  /** The layer name. Core names a layer with no name `Layer 1` (`getNextLayerName`). */
  name: string;
}

/** The core markers layer config (`MarkersConfig`). */
interface MarkersConfig {
  style?: MarkerStyleConfig;
}

/** Change a longitude to the range -180 to 180. Core repeats the world, so a longitude of 400 shows at 40. */
const wrapLongitude = (lon: number): number =>
  lon >= -180 && lon <= 180 ? lon : ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * The markers of one markers layer, as core draws them.
 * - Only the first frame of the layer gives markers: the frame loop of the core markers layer stops after one frame.
 *   The `filterData` option of the layer picks the frames (`getLayerFrames`, with the refIds of the panel queries).
 * - A row with no position gives no marker. Core skips a marker with the same position, color, size, text and
 *   rotation as an earlier one.
 */
function getLayerMarkers(
  frames: DataFrame[],
  layer: Partial<MapLayerOptions<MarkersConfig>>,
  theme: GrafanaTheme2,
  queryRefIds?: string[]
): GeoMarkers {
  const styleConfig = layer.config?.style;
  const style = getMarkerLayerStyle(styleConfig, theme);
  const tooltip = layer.tooltip !== false;
  const name = layer.name || 'Layer 1';
  const frame = getLayerFrames(frames, layer, queryRefIds)[0];
  if (!frame) {
    return { markers: [], style, tooltip, name };
  }
  const { positions = [] } = getFramePositions(frame, getLocationMatchers(layer.location));
  const values = getMarkerValues(frame, styleConfig, theme);
  const seen = new Set<string>();
  const markers: GeoMarker[] = [];
  positions.forEach((position, row) => {
    if (!position) {
      return;
    }
    const marker: GeoMarker = { lonLat: [wrapLongitude(position[0]), position[1]], rowIndex: row, ...values(row) };
    const key = [marker.lonLat, marker.color, marker.size, marker.text, marker.rotation].join('|');
    if (!seen.has(key)) {
      seen.add(key);
      markers.push(marker);
    }
  });
  return { markers, style, frame, tooltip, name };
}

/**
 * The markers of each `markers` layer, in the layer order. Core draws the last layer on top.
 * An unset `layers` option gives one layer of the Auto location and the default style (`defaultMarkersConfig`).
 * An empty list, or a list with no `markers` layer, gives no markers. The other layer types are not drawn yet.
 */
export function getMarkerLayers(
  frames: DataFrame[],
  layers: MapLayerOptions[] | undefined,
  theme: GrafanaTheme2,
  queryRefIds?: string[]
): GeoMarkers[] {
  return resolveLayers(layers)
    .filter((l) => l.type === MARKERS_LAYER_TYPE)
    .map((l) => getLayerMarkers(frames, l, theme, queryRefIds));
}
