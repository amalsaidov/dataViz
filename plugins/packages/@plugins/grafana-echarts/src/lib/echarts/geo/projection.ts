import { type GeoComponentOption } from 'echarts';
import { type LonLat } from 'lib/grafana/geo/gazetteer';

/** The projection shape of `geo.projection`. https://echarts.apache.org/en/option.html#geo.projection */
type GeoProjection = NonNullable<GeoComponentOption['projection']>;

/**
 * The latitude limit of Web Mercator (EPSG:3857), the projection of core Geomap (OpenLayers).
 * At this latitude the projected world is a square.
 * https://openlayers.org/en/latest/apidoc/module-ol_proj_epsg3857.html
 */
export const MERCATOR_MAX_LATITUDE = 85.0511287798066;

/**
 * Project `[lon, lat]` to Web Mercator in world units: the world is the square from -0.5 to 0.5 on each axis.
 * `y` points down, as the screen `y` of ECharts. A latitude out of the Mercator range is clamped, so the poles
 * of the basemap (Antarctica) stay finite.
 */
export function projectLonLat([lon, lat]: number[]): number[] {
  const clamped = Math.max(-MERCATOR_MAX_LATITUDE, Math.min(MERCATOR_MAX_LATITUDE, lat));
  const phi = (clamped * Math.PI) / 180;
  return [lon / 360, -Math.log(Math.tan(Math.PI / 4 + phi / 2)) / (2 * Math.PI)];
}

/** The inverse of `projectLonLat`. */
export function unprojectLonLat([x, y]: number[]): number[] {
  const lat = (2 * Math.atan(Math.exp(-y * 2 * Math.PI)) - Math.PI / 2) * (180 / Math.PI);
  return [x * 360, lat];
}

/**
 * Web Mercator for `geo.projection`. With a projection, `geo.center` is a projected coordinate, not `[lon, lat]`.
 * https://echarts.apache.org/en/option.html#geo.projection
 */
export const webMercator: GeoProjection = { project: projectLonLat, unproject: unprojectLonLat };

/**
 * `geo.boundingCoords` for the full Web Mercator world. ECharts then fits the world square, not the extent of
 * the basemap features, in the view. With `WORLD_LAYOUT`, `geo.zoom: 1` shows the world square.
 * https://echarts.apache.org/en/option.html#geo.boundingCoords
 */
export const WORLD_BOUNDING_COORDS: LonLat[] = [
  [-180, MERCATOR_MAX_LATITUDE],
  [180, -MERCATOR_MAX_LATITUDE],
];

/**
 * The `geo` layout that `toGeoZoom` needs: at `geo.zoom: 1` the world square fills the short side of the panel.
 * The ECharts default layout uses 80% of the short side.
 * https://echarts.apache.org/en/option.html#geo.layoutCenter
 */
export const WORLD_LAYOUT: Pick<GeoComponentOption, 'layoutCenter' | 'layoutSize'> = {
  layoutCenter: ['50%', '50%'],
  layoutSize: '100%',
};
