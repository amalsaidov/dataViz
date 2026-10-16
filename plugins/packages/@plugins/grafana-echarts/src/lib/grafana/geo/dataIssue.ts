import { type DataFrame } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import { type ChartDataIssue } from 'lib/echarts/charts/types';
import { type LonLat } from './gazetteer';
import { getLayerFrames, HEATMAP_LAYER_TYPE, MARKERS_LAYER_TYPE, resolveLayers, ROUTE_LAYER_TYPE } from './layers';
import { getFramePositions, getLocationMatchers } from './location';

const DATA_LAYER_TYPES = new Set([MARKERS_LAYER_TYPE, HEATMAP_LAYER_TYPE, ROUTE_LAYER_TYPE]);

type GeoIssueReason = 'layer-filter-no-frame' | 'location-field-missing' | 'location-out-of-range';

// Each message names the problem and the fix (epic #921). The location message starts with the text of the core
// Geomap location warning (`getGeometryField` in
// https://github.com/grafana/grafana/blob/main/public/app/features/geo/utils/location.ts).
export const GEO_ISSUE_MESSAGES: Record<GeoIssueReason, string> = {
  'layer-filter-no-frame':
    'The query refId filter matches no frame. Select a query that returns data in the layer filter.',
  'location-field-missing':
    'Unable to find location fields. Add latitude and longitude fields, a geohash field, or a lookup field.',
  'location-out-of-range':
    'Latitude must be between -90 and 90, and longitude must be between -180 and 180. Make sure that the latitude and longitude fields are not swapped.',
};

const inRange = ([lon, lat]: LonLat): boolean => lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;

/** The issue of one data layer, or `undefined` when the layer has a position on the map. */
function getLayerIssue(
  frames: DataFrame[],
  layer: MapLayerOptions,
  queryRefIds?: string[]
): GeoIssueReason | undefined {
  // A frame with no rows has no position. A filter that keeps only such frames matches no data.
  const layerFrames = getLayerFrames(frames, layer, queryRefIds).filter((frame) => frame.length > 0);
  if (layer.filterData && layerFrames.length === 0) {
    return 'layer-filter-no-frame';
  }
  const matchers = getLocationMatchers(layer.location);
  const found = layerFrames.map((frame) => getFramePositions(frame, matchers).positions);
  if (found.every((positions) => positions === undefined)) {
    return 'location-field-missing';
  }
  const defined = found
    .flatMap((positions) => positions ?? [])
    .filter((position): position is LonLat => position !== undefined);
  // A layer with only empty rows draws nothing, but its fields are correct.
  if (defined.length > 0 && !defined.some(inRange)) {
    return 'location-out-of-range';
  }
  return undefined;
}

/**
 * The data issue when the frames have rows, but no data layer (markers, heatmap or route) can put a position on the
 * map. Then the panel shows the Grafana error view, not an empty map (#864, #925). The issue of the first data layer
 * is given. A panel with only GeoJSON layers needs no location field, and gets no issue.
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
  const reasons = dataLayers.map((layer) => getLayerIssue(frames, layer, queryRefIds));
  if (reasons.some((reason) => reason === undefined)) {
    return undefined;
  }
  const reason = reasons[0]!;
  return { reason, message: GEO_ISSUE_MESSAGES[reason] };
}
