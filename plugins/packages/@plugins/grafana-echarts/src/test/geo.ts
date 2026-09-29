import { createDataFrame, createTheme, type DataFrame, dateTime, FieldType } from '@grafana/data';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { ScatterChart } from 'echarts/charts';
import { GeoComponent } from 'echarts/components';
import { type EChartsType, init, registerMap, use as registerEChartsModules } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { type ChartContext } from 'lib/echarts/charts/types';
import { BASEMAP_NAME } from 'lib/echarts/geo/basemap';
import { type EChartsFrame } from 'lib/grafana/types';
import { type PanelOptions } from 'types';

/** Shared fixtures for the geo family's rendered suites. */

export const geoTheme = createTheme();

/** A frame of `lat` and `lon` number fields, the core Auto coords shape. */
export const coordsFrame = (points: Array<[lat: number | null, lon: number | null]>): DataFrame =>
  createDataFrame({
    fields: [
      { name: 'lat', type: FieldType.number, values: points.map((p) => p[0]) },
      { name: 'lon', type: FieldType.number, values: points.map((p) => p[1]) },
    ],
  });

/** A geo chart context with the panel options of `extra`. */
export const geoContext = (frames: DataFrame[], extra: Partial<PanelOptions> = {}): ChartContext => ({
  frames: frames as EChartsFrame[],
  theme: geoTheme,
  timeZone: 'utc',
  timeRange: { from: dateTime(0), to: dateTime(1), raw: { from: 'now-1h', to: 'now' } },
  options: {
    legend: { showLegend: false, displayMode: LegendDisplayMode.List, placement: 'bottom', calcs: [] },
    tooltip: { mode: TooltipDisplayMode.Single, sort: SortOrder.None },
    ...extra,
  },
  seriesType: 'map',
  family: 'geo',
  formatValue: (value) => ({ text: String(value) }),
  fieldConfig: { defaults: {}, overrides: [] },
  replaceVariables: (value) => value,
});

// The GeoJSON input of `registerMap`. https://echarts.apache.org/en/api.html#echarts.registerMap
type MapSource = Parameters<typeof registerMap>[1];

/**
 * Replace the basemap with one 10 by 10 degree square at `[0, 0]`. The full basemap gives a large baseline; this
 * test map keeps it small. `basemap.integration.test.ts` tests the real basemap.
 */
export function registerTestBasemap(): void {
  registerEChartsModules([CanvasRenderer, GeoComponent, ScatterChart]);
  const square = [
    [0, 0],
    [10, 0],
    [10, 10],
    [0, 10],
    [0, 0],
  ];
  registerMap(BASEMAP_NAME, {
    type: 'FeatureCollection',
    features: [
      {
        type: 'Feature',
        id: 'SQ',
        properties: { name: 'square' },
        geometry: { type: 'Polygon', coordinates: [square] },
      },
    ],
  } as MapSource);
}

/** Render `option` on a canvas of `width` by `height` px. Call `dispose` of the result after the test. */
export function renderGeo(
  option: object,
  width: number,
  height: number
): { dom: HTMLDivElement; chart: EChartsType; dispose: () => void } {
  const dom = document.createElement('div');
  document.body.appendChild(dom);
  const chart = init(dom, undefined, { renderer: 'canvas', width, height });
  chart.setOption({ animation: false, ...option });
  return {
    dom,
    chart,
    dispose: () => {
      chart.dispose();
      dom.remove();
    },
  };
}
