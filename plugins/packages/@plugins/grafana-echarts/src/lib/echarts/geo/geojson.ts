import { type CustomSeriesOption, type CustomSeriesRenderItemAPI, type CustomSeriesRenderItemReturn } from 'echarts';
// `echarts/core` keeps the full `echarts` entry out of the bundle.
import { color as colorUtil } from 'echarts/core';
import { type GeoFeatureShape, type GeoJsonLayerShapes } from 'lib/grafana/geo/geojson';
import { type GeoJsonGeometry } from 'lib/grafana/geo/geojsonSource';

type Position = number[];
type Graphic = Exclude<CustomSeriesRenderItemReturn, null | undefined>;

/** The px path of rings or lines. A ring closes (`Z`). */
function toPathData(api: CustomSeriesRenderItemAPI, parts: Position[][], close: boolean): string {
  return parts
    .map((part) => {
      const points = part.map((p) => api.coord([p[0], p[1]]));
      return `M${points.map(([x, y]) => `${x} ${y}`).join('L')}${close ? 'Z' : ''}`;
    })
    .join('');
}

/**
 * The graphic elements of one geometry. A polygon is one path of all its rings, so a hole (a ring of the other
 * winding, RFC 7946 section 3.1.6) is not filled. A line has no fill. A point is a circle.
 * https://echarts.apache.org/en/option.html#series-custom.renderItem.return_path
 * https://echarts.apache.org/en/option.html#series-custom.renderItem.return_circle
 */
function toGraphics(api: CustomSeriesRenderItemAPI, geometry: GeoJsonGeometry, shape: GeoFeatureShape): Graphic[] {
  const { color: stroke, fillOpacity, lineWidth, radius } = shape.style;
  // The fill has the alpha, the stroke has none, as core `getFillColor`.
  // https://echarts.apache.org/en/api.html#echarts.color
  const fill = fillOpacity > 0 ? colorUtil.modifyAlpha(stroke, fillOpacity) : 'none';
  const path = (pathData: string, filled: boolean): Graphic => ({
    type: 'path',
    shape: { pathData },
    style: { fill: filled ? fill : 'none', stroke, lineWidth },
  });
  const circles = (points: Position[]): Graphic[] =>
    points.map((p) => {
      const [cx, cy] = api.coord([p[0], p[1]]);
      return { type: 'circle', shape: { cx, cy, r: radius }, style: { fill, stroke, lineWidth } };
    });
  switch (geometry.type) {
    case 'Point':
      return circles([geometry.coordinates]);
    case 'MultiPoint':
      return circles(geometry.coordinates);
    case 'LineString':
      return [path(toPathData(api, [geometry.coordinates], false), false)];
    case 'MultiLineString':
      return [path(toPathData(api, geometry.coordinates, false), false)];
    case 'Polygon':
      return [path(toPathData(api, geometry.coordinates, true), true)];
    case 'MultiPolygon':
      return [path(toPathData(api, geometry.coordinates.flat(), true), true)];
    case 'GeometryCollection':
      return geometry.geometries.flatMap((g) => toGraphics(api, g, shape));
  }
}

/**
 * One core GeoJSON layer as a custom series on the `geo` coordinate system: one group of shapes for each feature.
 * The series redraws on each pan and zoom of the map. The features do not react to the mouse.
 * https://echarts.apache.org/en/option.html#series-custom
 * https://echarts.apache.org/en/option.html#series-custom.coordinateSystem
 */
export function buildGeoJsonSeries(layer: GeoJsonLayerShapes, z: number): CustomSeriesOption {
  const { features } = layer;
  return {
    type: 'custom',
    coordinateSystem: 'geo',
    silent: true,
    z,
    // Each data item is the index of its feature. The custom series does not read the value as a position.
    data: features.map((_, i) => i),
    renderItem: (params, api) => {
      const feature = features[params.dataIndex];
      return { type: 'group', children: toGraphics(api, feature.geometry, feature) };
    },
  };
}
