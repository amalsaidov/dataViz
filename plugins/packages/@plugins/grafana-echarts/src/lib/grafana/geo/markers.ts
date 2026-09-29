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
import { getFramePositions, getLocationMatchers } from './location';

/** The layer type of the core markers layer (`MARKERS_LAYER_ID`). */
export const MARKERS_LAYER_TYPE = 'markers';

/** One marker: the position and the values of its row. */
export interface GeoMarker extends MarkerValues {
  lonLat: LonLat;
}

/** The markers of a layer, and the style that all of them share. */
export interface GeoMarkers {
  markers: GeoMarker[];
  style: MarkerLayerStyle;
}

/** The core markers layer config (`MarkersConfig`). */
interface MarkersConfig {
  style?: MarkerStyleConfig;
}

/** Change a longitude to the range -180 to 180. Core repeats the world, so a longitude of 400 shows at 40. */
const wrapLongitude = (lon: number): number =>
  lon >= -180 && lon <= 180 ? lon : ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * The markers, as core draws them for the first `markers` layer.
 * - Only an unset `layers` option gives the Auto location and the default style (`defaultMarkersConfig`). An empty
 *   list, or a list with no `markers` layer, gives no markers.
 * - Only the first frame gives markers: the frame loop of the core markers layer stops after one frame.
 * - A row with no position gives no marker. Core skips a marker with the same position, color, size, text and
 *   rotation as an earlier one.
 */
export function getMarkers(
  frames: DataFrame[],
  layers: MapLayerOptions[] | undefined,
  theme: GrafanaTheme2
): GeoMarkers {
  const layer: Partial<MapLayerOptions<MarkersConfig>> | undefined = layers
    ? layers.find((l) => l.type === MARKERS_LAYER_TYPE)
    : {};
  const styleConfig = layer?.config?.style;
  const style = getMarkerLayerStyle(styleConfig, theme);
  const frame = frames[0];
  if (!frame || !layer) {
    return { markers: [], style };
  }
  const { positions = [] } = getFramePositions(frame, getLocationMatchers(layer.location));
  const values = getMarkerValues(frame, styleConfig, theme);
  const seen = new Set<string>();
  const markers: GeoMarker[] = [];
  positions.forEach((position, row) => {
    if (!position) {
      return;
    }
    const marker: GeoMarker = { lonLat: [wrapLongitude(position[0]), position[1]], ...values(row) };
    const key = [marker.lonLat, marker.color, marker.size, marker.text, marker.rotation].join('|');
    if (!seen.has(key)) {
      seen.add(key);
      markers.push(marker);
    }
  });
  return { markers, style };
}
