import { type DataFrame } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import { type ChartDataIssue } from 'lib/echarts/charts/types';
import { getLayerFrames, HEATMAP_LAYER_TYPE, MARKERS_LAYER_TYPE, resolveLayers, ROUTE_LAYER_TYPE } from './layers';
import { getFramePositions, getLocationMatchers } from './location';

const DATA_LAYER_TYPES = new Set([MARKERS_LAYER_TYPE, HEATMAP_LAYER_TYPE, ROUTE_LAYER_TYPE]);

// The text of the core Geomap location warning (`getGeometryField` in
// https://github.com/grafana/grafana/blob/main/public/app/features/geo/utils/location.ts).
const NO_LOCATION = 'Unable to find location fields';

const hasLocation = (frames: DataFrame[], layer: MapLayerOptions, queryRefIds?: string[]): boolean =>
  getLayerFrames(frames, layer, queryRefIds).some(
    (frame) => getFramePositions(frame, getLocationMatchers(layer.location)).positions !== undefined
  );

/**
 * The data issue when the frames have rows, but no data layer (markers, heatmap or route) finds location fields in
 * its frames. Then the panel shows the Grafana error view, not an empty map (#864).
 * A panel with only GeoJSON layers needs no location field, and gets no issue.
 */
export function getGeoDataIssue(
  frames: DataFrame[],
  layers: MapLayerOptions[] | undefined,
  queryRefIds?: string[]
): ChartDataIssue | undefined {
  const dataLayers = resolveLayers(layers).filter((layer) => DATA_LAYER_TYPES.has(layer.type));
  if (dataLayers.length === 0 || frames.every((frame) => frame.length === 0)) {
    return undefined;
  }
  if (dataLayers.some((layer) => hasLocation(frames, layer, queryRefIds))) {
    return undefined;
  }
  return { reason: 'location-field-missing', message: NO_LOCATION };
}
