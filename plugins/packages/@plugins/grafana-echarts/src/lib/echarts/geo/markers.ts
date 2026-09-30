import {
  type GeoComponentOption,
  type HeatmapSeriesOption,
  type ScatterSeriesOption,
  type VisualMapComponentOption,
} from 'echarts';
import { type EChartGeoOption } from 'lib/echarts/charts/types';
import { type LonLat } from 'lib/grafana/geo/gazetteer';
import { type GeoHeatmap } from 'lib/grafana/geo/heatmap';
import { type SymbolAlign } from 'lib/grafana/geo/dimensions';
import { type GeoMarker, type GeoMarkers } from 'lib/grafana/geo/markers';
import { type BasemapStyle } from 'lib/grafana/geo/style';
import { type CoreMapView } from 'lib/grafana/geo/view';
import { BASEMAP_NAME } from './basemap';
import { buildHeatmapLayer } from './heatmap';
import { WORLD_BOUNDING_COORDS, webMercator } from './projection';
import { getMarkerSymbol } from './symbols';
import { geoMarkerTooltip, type GeoTooltipContext } from './tooltip';
import { toGeoView, toGeoZoom, type ViewSize } from './view';

type EChartGeoSeries = ScatterSeriesOption | HeatmapSeriesOption;

/** The input of `buildGeoOption`. The colors are CSS colors, from `lib/grafana/geo`. */
export interface GeoMarkersInput {
  /** The markers of each markers layer, in the core layer order. */
  layers: GeoMarkers[];
  /** The points of each heatmap layer. */
  heatmaps: GeoHeatmap[];
  view: CoreMapView;
  size: ViewSize;
  /** The core `controls.mouseWheelZoom`: the mouse wheel zooms the map. */
  mouseWheelZoom: boolean;
  basemapStyle: BasemapStyle;
  /** The theme, time zone and sink of the marker tooltip. */
  tooltip: GeoTooltipContext;
}

/**
 * The `geo` component: the basemap in Web Mercator at the core map view. The basemap areas do not react to the
 * mouse. "Fit to data" fits the markers and the heatmap points. A drag pans the map, as core. The mouse wheel zooms it only with
 * `mouseWheelZoom`. The view `minZoom` and `maxZoom` limit the zoom.
 * https://echarts.apache.org/en/option.html#geo
 * https://echarts.apache.org/en/option.html#geo.roam
 * https://echarts.apache.org/en/option.html#geo.scaleLimit
 */
export function buildGeoComponent(input: GeoMarkersInput): GeoComponentOption {
  const { layers, heatmaps, view, size, basemapStyle, mouseWheelZoom } = input;
  const positions: LonLat[] = [
    ...layers.flatMap((l) => l.markers.map((m) => m.lonLat)),
    ...heatmaps.flatMap((h) => h.points.map((p) => p.lonLat)),
  ];
  return {
    map: BASEMAP_NAME,
    projection: webMercator,
    boundingCoords: WORLD_BOUNDING_COORDS,
    ...toGeoView(view, size, positions),
    silent: true,
    roam: mouseWheelZoom ? true : 'move',
    scaleLimit: { min: toGeoZoom(view.minZoom, size), max: toGeoZoom(view.maxZoom, size) },
    itemStyle: { areaColor: basemapStyle.area, borderColor: basemapStyle.border, borderWidth: 0.5 },
  };
}

/**
 * The px offset of a symbol, as core `getDisplacement`: `size` px to the side of the alignment. OpenLayers turns
 * the offset with the symbol, so the offset turns by `rotation` degrees clockwise.
 */
function getSymbolOffset(align: SymbolAlign, size: number, rotation: number): [number, number] {
  const x = align.horizontal === 'left' ? -size : align.horizontal === 'right' ? size : 0;
  const y = align.vertical === 'top' ? -size : align.vertical === 'bottom' ? size : 0;
  const angle = (rotation * Math.PI) / 180;
  return [x * Math.cos(angle) - y * Math.sin(angle), x * Math.sin(angle) + y * Math.cos(angle)];
}

// The shared options of the marker series.
const markerSeries = { type: 'scatter', coordinateSystem: 'geo', silent: true } as const;

/**
 * The mouse options of a series of the markers in `data`. A layer with a tooltip reacts to the mouse and shows the
 * tooltip of the marker row. Core draws no hover state, so the emphasis is off.
 * https://echarts.apache.org/en/option.html#series-scatter.emphasis.disabled
 */
function markerMouse(
  layer: GeoMarkers,
  data: GeoMarker[],
  ctx: GeoTooltipContext
): Pick<ScatterSeriesOption, 'silent' | 'emphasis' | 'tooltip'> {
  if (!layer.tooltip) {
    return { silent: true };
  }
  return { silent: false, emphasis: { disabled: true }, tooltip: geoMarkerTooltip(layer, data, ctx) };
}

// ECharts draws a label over the symbols of a series of the same `z`. Core draws the symbols over the text, so the
// symbol series are one level above the text series. Each layer is 2 levels above the layer before it, so a layer
// draws over each layer before it, as the core layer order. https://echarts.apache.org/en/option.html#series-scatter.z
const TEXT_Z = 2;
const Z_PER_LAYER = 2;

/**
 * The series of one core markers layer at the `z` of its text. Each marker has the size, color, rotation and text of
 * its row. The series order is the core order in a layer: the text, then the symbols over it.
 * https://echarts.apache.org/en/option.html#series-scatter
 */
function buildMarkerSeries(layer: GeoMarkers, textZ: number, tooltip: GeoTooltipContext): ScatterSeriesOption[] {
  const { markers, style } = layer;
  const symbolZ = textZ + 1;
  const { symbol, kind } = getMarkerSymbol(style.symbol);
  // Core turns the shapes and the icons, not the circle.
  const rotation = (deg: number) => (kind === 'circle' ? 0 : deg);
  const offset = (size: number, deg: number) => getSymbolOffset(style.symbolAlign, size, rotation(deg));
  const series: ScatterSeriesOption[] = [];

  if (style.text) {
    const { fontSize, fontFamily, textAlign, textBaseline, offsetX, offsetY } = style.text;
    const withText = markers.filter((m) => m.text);
    series.push({
      ...markerSeries,
      ...markerMouse(layer, withText, tooltip),
      z: textZ,
      symbolSize: 0,
      // OpenLayers `Text` at the marker position and the px offset. Core hides the text that overlaps (`declutter`).
      label: {
        show: true,
        formatter: '{b}',
        position: [offsetX, offsetY],
        align: textAlign,
        verticalAlign: textBaseline,
        fontSize,
        fontFamily,
        fontWeight: 'normal',
      },
      labelLayout: { hideOverlap: true },
      data: withText.map((m) => ({ name: m.text, value: m.lonLat, label: { color: m.color } })),
    });
  }

  if (style.showSymbol && kind === 'icon') {
    // The faint disc that core adds behind each icon.
    series.push({
      ...markerSeries,
      z: symbolZ,
      symbol: 'circle',
      data: markers.map((m) => ({
        value: m.lonLat,
        symbolSize: m.size * 2,
        symbolOffset: offset(m.size, m.rotation),
        itemStyle: { color: m.iconBackground, opacity: 1 },
      })),
    });
  }

  if (style.showSymbol) {
    series.push({
      ...markerSeries,
      ...markerMouse(layer, markers, tooltip),
      z: symbolZ,
      symbol,
      data: markers.map((m) => ({
        value: m.lonLat,
        symbolSize: m.size * 2,
        // ECharts turns a symbol counterclockwise; core turns it clockwise.
        symbolRotate: -rotation(m.rotation),
        symbolOffset: offset(m.size, m.rotation),
        // The ECharts scatter default opacity is 0.8; the fill color has the core alpha. The core stroke has the
        // fill color, so no border is drawn.
        itemStyle: { color: m.fill, opacity: 1 },
      })),
    });
  }

  return series;
}

/** The `z` of the lowest series of the layer at `layerIndex` in the core layer list. */
const layerZ = (layerIndex: number) => TEXT_Z + layerIndex * Z_PER_LAYER;

/**
 * The basemap, the markers of each core markers layer and the points of each heatmap layer. A later layer draws
 * over the layers before it.
 */
export function buildGeoOption(input: GeoMarkersInput): EChartGeoOption {
  const series: EChartGeoSeries[] = input.layers.flatMap((layer) =>
    buildMarkerSeries(layer, layerZ(layer.layerIndex), input.tooltip)
  );
  const visualMap: VisualMapComponentOption[] = [];
  for (const heatmap of input.heatmaps) {
    const layer = buildHeatmapLayer(heatmap, series.length, layerZ(heatmap.layerIndex));
    series.push(layer.series);
    visualMap.push(layer.visualMap);
  }
  return { geo: buildGeoComponent(input), series, ...(visualMap.length ? { visualMap } : {}) };
}
