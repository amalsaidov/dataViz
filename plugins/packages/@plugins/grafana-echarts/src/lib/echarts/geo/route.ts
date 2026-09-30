import { type LinesSeriesOption } from 'echarts';
import { type GeoRoute, type RoutePoint } from 'lib/grafana/geo/route';

// A color or a gradient: a line data item takes no color callback.
type LineColor = Exclude<NonNullable<NonNullable<LinesSeriesOption['lineStyle']>['color']>, Function>;

/**
 * The color of a segment from `a` to `b`. Two colors give a linear gradient on the box of the segment. The box
 * corners are the segment ends, so the gradient goes from `a` to `b`, as the core `FlowLine` `color` and `color2`.
 * https://echarts.apache.org/en/option.html#color
 */
function segmentColor(a: RoutePoint, b: RoutePoint): LineColor {
  if (a.color === b.color) {
    return a.color;
  }
  const east = b.lonLat[0] >= a.lonLat[0];
  // The canvas y goes down, so the north end is at y 0.
  const north = b.lonLat[1] >= a.lonLat[1];
  return {
    type: 'linear',
    x: east ? 0 : 1,
    x2: east ? 1 : 0,
    y: north ? 1 : 0,
    y2: north ? 0 : 1,
    colorStops: [
      { offset: 0, color: a.color },
      { offset: 1, color: b.color },
    ],
  };
}

/** The ECharts symbols at the start and the end of each segment: the core forward or reverse arrow. */
const ARROW_SYMBOLS = { '1': ['none', 'arrow'], '-1': ['arrow', 'none'] } as const;

/**
 * One core route layer as an ECharts `lines` series on the `geo` coordinate system.
 * - With no style field and no arrow, core draws one OpenLayers line with round caps in the first color.
 * - Else core draws each segment as an ol-ext `FlowLine`: the colors of its two points, the width of its first
 *   point, and an arrow of `1.5 * width` px in the color of the arrow end. The arrow line has flat caps.
 * The route has no hover state and no tooltip.
 * https://echarts.apache.org/en/option.html#series-lines
 * https://echarts.apache.org/en/option.html#series-lines.polyline
 * https://echarts.apache.org/en/option.html#series-lines.data.symbolSize
 * https://viglino.github.io/ol-ext/doc/doc-pages/ol.style.FlowLine.html
 */
export function buildRouteSeries(route: GeoRoute, z: number): LinesSeriesOption {
  const { points, arrow } = route;
  const series: LinesSeriesOption = {
    type: 'lines',
    coordinateSystem: 'geo',
    silent: true,
    z,
    // The ECharts default line opacity is 0.5. The colors have the core alpha.
    lineStyle: { opacity: 1, cap: arrow === 0 ? 'round' : 'butt', join: 'round' },
    symbol: arrow === 0 ? 'none' : [...ARROW_SYMBOLS[arrow]],
  };
  if (!route.segments) {
    const [first] = points;
    return {
      ...series,
      polyline: true,
      data: points.length
        ? [{ coords: points.map((p) => p.lonLat), lineStyle: { color: first.color, width: first.width } }]
        : [],
    };
  }
  return {
    ...series,
    data: points.slice(1).map((b, i) => {
      const a = points[i];
      const arrowEnd = arrow === -1 ? a : b;
      return {
        coords: [a.lonLat, b.lonLat],
        lineStyle: { color: segmentColor(a, b), width: a.width },
        symbolSize: arrowEnd.width * 1.5,
      };
    }),
  };
}
