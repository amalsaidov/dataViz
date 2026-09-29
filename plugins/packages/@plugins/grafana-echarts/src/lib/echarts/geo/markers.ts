import { type GeoComponentOption, type ScatterSeriesOption } from 'echarts';
import { type EChartGeoOption } from 'lib/echarts/charts/types';
import { type LonLat } from 'lib/grafana/geo/gazetteer';
import { type SymbolAlign } from 'lib/grafana/geo/dimensions';
import { type GeoMarkers } from 'lib/grafana/geo/markers';
import { type BasemapStyle } from 'lib/grafana/geo/style';
import { type CoreMapView } from 'lib/grafana/geo/view';
import { BASEMAP_NAME } from './basemap';
import { WORLD_BOUNDING_COORDS, webMercator } from './projection';
import { getMarkerSymbol } from './symbols';
import { toGeoView, type ViewSize } from './view';

/** The input of `buildGeoOption`. The colors are CSS colors, from `lib/grafana/geo`. */
export interface GeoMarkersInput {
  markers: GeoMarkers;
  view: CoreMapView;
  size: ViewSize;
  basemapStyle: BasemapStyle;
}

/**
 * The `geo` component: the basemap in Web Mercator at the core map view. The basemap does not react to the
 * mouse. "Fit to data" fits the markers.
 * https://echarts.apache.org/en/option.html#geo
 */
export function buildGeoComponent({ markers, view, size, basemapStyle }: GeoMarkersInput): GeoComponentOption {
  const positions: LonLat[] = markers.markers.map((m) => m.lonLat);
  return {
    map: BASEMAP_NAME,
    projection: webMercator,
    boundingCoords: WORLD_BOUNDING_COORDS,
    ...toGeoView(view, size, positions),
    silent: true,
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

// The shared options of the marker series. The markers have no tooltip or hover state yet (#332).
const markerSeries = { type: 'scatter', coordinateSystem: 'geo', silent: true } as const;
// ECharts draws a label over the symbols of a series of the same `z`. Core draws the symbols over the text, so the
// symbol series are one level above the scatter default 2. https://echarts.apache.org/en/option.html#series-scatter.z
const SYMBOL_Z = 3;

/**
 * The basemap and the markers of the core markers layer. Each marker has the size, color, rotation and text of its
 * row. The series order is the core layer order: the text, then the symbols over it.
 * https://echarts.apache.org/en/option.html#series-scatter
 */
export function buildGeoOption(input: GeoMarkersInput): EChartGeoOption {
  const { markers, style } = input.markers;
  const { symbol, kind } = getMarkerSymbol(style.symbol);
  // Core turns the shapes and the icons, not the circle.
  const rotation = (deg: number) => (kind === 'circle' ? 0 : deg);
  const offset = (size: number, deg: number) => getSymbolOffset(style.symbolAlign, size, rotation(deg));
  const series: ScatterSeriesOption[] = [];

  if (style.text) {
    const { fontSize, fontFamily, textAlign, textBaseline, offsetX, offsetY } = style.text;
    series.push({
      ...markerSeries,
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
      data: markers.filter((m) => m.text).map((m) => ({ name: m.text, value: m.lonLat, label: { color: m.color } })),
    });
  }

  if (style.showSymbol && kind === 'icon') {
    // The faint disc that core adds behind each icon.
    series.push({
      ...markerSeries,
      z: SYMBOL_Z,
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
      z: SYMBOL_Z,
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

  return { geo: buildGeoComponent(input), series };
}
