import { createDataFrame, createTheme, type DataFrame, dateTime, FieldType } from '@grafana/data';
import { LegendDisplayMode, SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { CustomChart, HeatmapChart, LinesChart, ScatterChart } from 'echarts/charts';
import { GeoComponent, VisualMapContinuousComponent } from 'echarts/components';
import { type EChartsType, init, registerMap, setPlatformAPI, use as registerEChartsModules } from 'echarts/core';
import { CanvasRenderer } from 'echarts/renderers';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
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
  // The heatmap and GeoJSON layers need the modules that `lib/echarts/echarts.ts` registers for the panel. The route
  // layer needs the `lines` series of `registerBasemap`.
  registerEChartsModules([
    CanvasRenderer,
    GeoComponent,
    ScatterChart,
    HeatmapChart,
    LinesChart,
    CustomChart,
    VisualMapContinuousComponent,
  ]);
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

/**
 * Keep each canvas that zrender makes after this call. The ECharts heatmap draws its points on such canvases, then
 * copies the colored canvas to the panel canvas. Call `restore` of the result after the test.
 * https://echarts.apache.org/en/api.html#echarts.setPlatformAPI
 */
export function captureZrenderCanvases(): { canvases: HTMLCanvasElement[]; restore: () => void } {
  const canvases: HTMLCanvasElement[] = [];
  // The zrender default in a browser is a new canvas element.
  const create = () => document.createElement('canvas');
  setPlatformAPI({
    createCanvas: () => {
      const canvas = create();
      canvases.push(canvas);
      return canvas;
    },
  });
  return { canvases, restore: () => setPlatformAPI({ createCanvas: create }) };
}

/** The draw calls of a canvas of jest-canvas-mock. */
export const readCanvasEvents = (canvas: HTMLCanvasElement): CanvasRenderingContext2DEvent[] =>
  (canvas.getContext('2d') as unknown as { __getEvents: () => CanvasRenderingContext2DEvent[] }).__getEvents();

/**
 * The panel draw calls with the heatmap image replaced by its point draws, so that the canvas viewer can paint
 * them. The viewer does not replay `drawImage`. Each point draw becomes the brush draws at the point offset, with
 * the alpha of the weight, in white. The blur and the gradient colors are not in the result: jest-canvas-mock does not keep pixels.
 */
export function inlineHeatmapDraws(
  panel: CanvasRenderingContext2DEvent[],
  heat: CanvasRenderingContext2DEvent[],
  brush: CanvasRenderingContext2DEvent[]
): CanvasRenderingContext2DEvent[] {
  // The brush draws a black circle to the left of its canvas, and its blurred shadow in the center. The viewer does
  // not replay shadows, so the circle moves to the shadow position, in white on the dark basemap.
  const offset = Number(brush.find((e) => e.type === 'shadowOffsetX')?.props.value ?? 0);
  const arc = brush.find((e) => e.type === 'arc');
  const disc: CanvasRenderingContext2DEvent[] = arc
    ? [
        { ...arc, type: 'beginPath', props: {} },
        // Clockwise: the snapshot rounds the end angle below 2 pi, and an anticlockwise arc then draws nothing.
        { ...arc, props: { ...arc.props, x: Number(arc.props.x) + offset, anticlockwise: false } },
      ]
    : [];
  const brushDraws: CanvasRenderingContext2DEvent[] = arc
    ? [
        { ...arc, type: 'fillStyle', props: { value: '#ffffff' } },
        ...disc,
        { ...arc, type: 'fill', props: { path: disc, fillRule: 'nonzero' } },
      ]
    : [];
  const points = heat.flatMap((e): CanvasRenderingContext2DEvent[] => {
    if (e.type === 'globalAlpha') {
      return [e];
    }
    if (e.type !== 'drawImage') {
      return [];
    }
    const { dx, dy } = e.props as { dx: number; dy: number };
    const move = { ...e, type: 'setTransform', props: { a: 1, b: 0, c: 0, d: 1, e: dx, f: dy } };
    return [move, ...brushDraws];
  });
  const save = { ...panel[0], type: 'save', props: {} };
  const restore = { ...panel[0], type: 'restore', props: {} };
  return panel.flatMap((e) => (e.type === 'drawImage' ? [save, ...points, restore] : [e]));
}
