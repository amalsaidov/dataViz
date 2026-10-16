// The line of the core Geomap route layer.
// Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/routeLayer.tsx
import { colorManipulator, type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import { DEFAULT_MARKER_STYLE, getMarkerValues, type MarkerStyleConfig } from './dimensions';
import { type LonLat } from './gazetteer';
import { getLayerFrames, resolveLayers, ROUTE_LAYER_TYPE } from './layers';
import { getFramePositions, getLocationMatchers } from './location';
import { wrapLongitude } from './markers';

/** The core route arrow: none, at the end of each segment, or at the start of each segment. */
export type RouteArrow = 0 | 1 | -1;

/** The core route style: the markers style and the line width. */
export interface RouteStyleConfig extends MarkerStyleConfig {
  lineWidth?: number;
}

/** The core route layer config (`RouteConfig`). */
export interface RouteConfig {
  style?: RouteStyleConfig;
  arrow?: RouteArrow;
}

/** The core `defaultOptions` of the route layer. */
export const DEFAULT_ROUTE_CONFIG = {
  style: { ...DEFAULT_MARKER_STYLE, opacity: 1, lineWidth: 2 },
  arrow: 0,
} satisfies RouteConfig;

/** One point of the route: the position, and the CSS color and the px width of its row. */
export interface RoutePoint {
  lonLat: LonLat;
  color: string;
  width: number;
}

/** The line of a route layer. */
export interface GeoRoute {
  /** The points in the row order. Core draws a line only for 2 or more points. */
  points: RoutePoint[];
  /**
   * True when core draws the route as segments (`FlowLine`): a style field or an arrow. Each segment then has the
   * colors of its two points. Else core draws one line in the color of the first point.
   */
  segments: boolean;
  arrow: RouteArrow;
  /** The index of the layer in the core layer list. A later layer draws on top. */
  layerIndex: number;
}

/** True when the style reads a field, as core `getStyleConfigState` `fields`. */
const hasStyleField = (style: RouteStyleConfig): boolean =>
  Boolean(style.color?.field || style.size?.field || style.rotation?.field || style.text?.field);

/**
 * The line of one route layer. Only the first frame of the layer gives points, as core. A row with no position
 * gives no point.
 */
function getRoute(
  frames: DataFrame[],
  layer: Partial<MapLayerOptions<RouteConfig>>,
  layerIndex: number,
  theme: GrafanaTheme2,
  queryRefIds?: string[]
): GeoRoute {
  const style: RouteStyleConfig = { ...DEFAULT_ROUTE_CONFIG.style, ...layer.config?.style };
  const arrow = layer.config?.arrow ?? DEFAULT_ROUTE_CONFIG.arrow;
  const segments = hasStyleField(style) || arrow !== 0;
  const base = { segments, arrow, layerIndex };
  const frame = getLayerFrames(frames, layer, queryRefIds)[0];
  if (!frame) {
    return { ...base, points: [] };
  }
  const { positions = [] } = getFramePositions(frame, getLocationMatchers(layer.location));
  const values = getMarkerValues(frame, style, theme);
  const opacity = style.opacity ?? 1;
  // One line: core sets the width to `size.fixed`, or else to `lineWidth` (`getStrokeStyle`).
  const lineWidth = style.size?.fixed || (style.lineWidth ?? 1);
  const points: RoutePoint[] = [];
  positions.forEach((position, row) => {
    if (position) {
      const v = values(row);
      points.push({
        lonLat: [wrapLongitude(position[0]), position[1]],
        // Core sets the alpha of the color to `opacity` (tinycolor `setAlpha`).
        // https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/themes/colorManipulator.ts
        color: colorManipulator.alpha(v.color, opacity),
        width: segments ? v.size : lineWidth,
      });
    }
  });
  return { ...base, points: points.length >= 2 ? points : [] };
}

/** The line of each `route` layer, in the layer order. */
export function getRouteLayers(
  frames: DataFrame[],
  layers: MapLayerOptions[] | undefined,
  theme: GrafanaTheme2,
  queryRefIds?: string[]
): GeoRoute[] {
  return resolveLayers(layers).flatMap((layer, index) =>
    layer.type === ROUTE_LAYER_TYPE ? [getRoute(frames, layer, index, theme, queryRefIds)] : []
  );
}
