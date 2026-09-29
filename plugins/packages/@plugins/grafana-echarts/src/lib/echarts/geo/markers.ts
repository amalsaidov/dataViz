import { type GeoComponentOption } from 'echarts';
import { type EChartGeoOption } from 'lib/echarts/charts/types';
import { type LonLat } from 'lib/grafana/geo/gazetteer';
import { type BasemapStyle, type MarkerStyle } from 'lib/grafana/geo/style';
import { type CoreMapView } from 'lib/grafana/geo/view';
import { BASEMAP_NAME } from './basemap';
import { WORLD_BOUNDING_COORDS, webMercator } from './projection';
import { toGeoView, type ViewSize } from './view';

/** The input of `buildGeoOption`. The styles are CSS colors, from `lib/grafana/geo/style.ts`. */
export interface GeoMarkersInput {
  markers: LonLat[];
  view: CoreMapView;
  size: ViewSize;
  markerStyle: MarkerStyle;
  basemapStyle: BasemapStyle;
}

/**
 * The `geo` component: the basemap in Web Mercator at the core map view. The basemap does not react to the
 * mouse. "Fit to data" fits the markers.
 * https://echarts.apache.org/en/option.html#geo
 */
export function buildGeoComponent({ markers, view, size, basemapStyle }: GeoMarkersInput): GeoComponentOption {
  return {
    map: BASEMAP_NAME,
    projection: webMercator,
    boundingCoords: WORLD_BOUNDING_COORDS,
    ...toGeoView(view, size, markers),
    silent: true,
    itemStyle: { areaColor: basemapStyle.area, borderColor: basemapStyle.border, borderWidth: 0.5 },
  };
}

/**
 * The basemap and the markers, each a circle of one fixed style. The circle diameter is two times the core radius.
 * https://echarts.apache.org/en/option.html#series-scatter
 */
export function buildGeoOption(input: GeoMarkersInput): EChartGeoOption {
  const { markers, markerStyle } = input;
  return {
    geo: buildGeoComponent(input),
    series: [
      {
        type: 'scatter',
        coordinateSystem: 'geo',
        symbol: 'circle',
        symbolSize: markerStyle.radius * 2,
        // The ECharts scatter default opacity is 0.8; the fill color has the core opacity.
        itemStyle: {
          color: markerStyle.fill,
          borderColor: markerStyle.stroke,
          borderWidth: markerStyle.lineWidth,
          opacity: 1,
        },
        // The markers have no tooltip or hover state yet (#332).
        silent: true,
        data: markers,
      },
    ],
  };
}
