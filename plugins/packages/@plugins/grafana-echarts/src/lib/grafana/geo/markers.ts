// The marker positions of the core Geomap markers layer.
// Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/markersLayer.tsx
// and `initLayers` in https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/GeomapPanel.tsx
import { type DataFrame } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import { type LonLat } from './gazetteer';
import { getFramePositions, getLocationMatchers } from './location';

/** The layer type of the core markers layer (`MARKERS_LAYER_ID`). */
export const MARKERS_LAYER_TYPE = 'markers';

/** Change a longitude to the range -180 to 180. Core repeats the world, so a longitude of 400 shows at 40. */
const wrapLongitude = (lon: number): number =>
  lon >= -180 && lon <= 180 ? lon : ((((lon + 180) % 360) + 360) % 360) - 180;

/**
 * The positions of the markers, as core draws them for the first `markers` layer.
 * - Only an unset `layers` option gives the Auto location (`defaultMarkersConfig`). An empty list, or a list with
 *   no `markers` layer, gives no markers.
 * - Only the first frame gives markers: the frame loop of the core markers layer stops after one frame.
 * - A row with no position gives no marker. Core skips a marker with the same position and style as an earlier one.
 */
export function getMarkerPositions(frames: DataFrame[], layers?: MapLayerOptions[]): LonLat[] {
  const frame = frames[0];
  const layer = layers ? layers.find((l) => l.type === MARKERS_LAYER_TYPE) : { location: undefined };
  if (!frame || !layer) {
    return [];
  }
  const { positions = [] } = getFramePositions(frame, getLocationMatchers(layer.location));
  const seen = new Set<string>();
  const markers: LonLat[] = [];
  for (const position of positions) {
    if (!position) {
      continue;
    }
    const marker: LonLat = [wrapLongitude(position[0]), position[1]];
    const key = marker.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      markers.push(marker);
    }
  }
  return markers;
}
