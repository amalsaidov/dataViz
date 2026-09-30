import { type HeatmapSeriesOption, type VisualMapComponentOption } from 'echarts';
import { type GeoHeatmap } from 'lib/grafana/geo/heatmap';

/** The series and the visual map of one heatmap layer. */
export interface HeatmapLayerOption {
  series: HeatmapSeriesOption;
  visualMap: VisualMapComponentOption;
}

/**
 * One core heatmap layer as an ECharts heatmap series on the `geo` coordinate system. As OpenLayers `Heatmap`,
 * each point is a circle of `radius` px with a blur of `blur` px, and its alpha is the weight. The sum of the
 * alphas picks the gradient color. The heatmap has no hover state.
 * https://echarts.apache.org/en/option.html#series-heatmap.pointSize
 * https://echarts.apache.org/en/option.html#series-heatmap.blurSize
 * https://openlayers.org/en/latest/apidoc/module-ol_layer_Heatmap-Heatmap.html
 */
export function buildHeatmapLayer(layer: GeoHeatmap, seriesIndex: number, z: number): HeatmapLayerOption {
  return {
    series: {
      type: 'heatmap',
      coordinateSystem: 'geo',
      silent: true,
      z,
      pointSize: layer.radius,
      blurSize: layer.blur,
      data: layer.points.map((p) => [p.lonLat[0], p.lonLat[1], p.weight]),
    },
    // An ECharts heatmap needs a visual map for its gradient. The weight is from 0 to 1. It is not shown.
    // https://echarts.apache.org/en/option.html#visualMap-continuous
    visualMap: {
      type: 'continuous',
      show: false,
      seriesIndex,
      dimension: 2,
      min: 0,
      max: 1,
      inRange: { color: layer.colors },
    },
  };
}
