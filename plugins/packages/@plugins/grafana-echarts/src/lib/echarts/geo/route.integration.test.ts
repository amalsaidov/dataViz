import { createDataFrame, FieldColorModeId, FieldType } from '@grafana/data';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { type ChartContext } from 'lib/echarts/charts/types';
import { buildPanelChartOption } from 'lib/echarts/options/panelOption';
import { geoContext, geoTheme, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The drawn line of the route layer against core Geomap. Core draws one OpenLayers line with no style field and no
// arrow, else one ol-ext `FlowLine` for each segment, with an arrow of `1.5 * width` px.
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/routeLayer.tsx
// https://viglino.github.io/ol-ext/doc/doc-pages/ol.style.FlowLine.html

const size = 256;
// The view center is the first point, so that point is at the panel center.
const view = { id: 'coords', lat: 5, lon: 5, zoom: 3 };
const frame = createDataFrame({
  fields: [
    { name: 'lat', type: FieldType.number, values: [5, 6, 7] },
    { name: 'lon', type: FieldType.number, values: [5, 6, 8] },
    {
      name: 'speed',
      type: FieldType.number,
      values: [0, 5, 10],
      config: { color: { mode: FieldColorModeId.ContinuousGrYlRd } },
    },
  ],
});
const layer = (config: object) => ({ type: 'route', name: 'R', location: { mode: 'auto' }, config });
const context = (layers: object[]) => geoContext([frame], { view, layers } as Partial<ChartContext['options']>);

type Props = Record<string, unknown>;
const props = (e: CanvasRenderingContext2DEvent) => e.props as Props;

/** The canvas events of the panel layer. */
function draw(layers: object[]): CanvasRenderingContext2DEvent[] {
  const option = buildPanelChartOption(context(layers), { isGrafanaLegend: true, plotWidth: size, plotHeight: size });
  const { dom, dispose } = renderGeo(option ?? {}, size, size);
  const events = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
  dispose();
  return events;
}

interface Stroke {
  points: Array<[number, number]>;
  width: unknown;
  cap: unknown;
  style: unknown;
}

/** Each line stroke after the basemap: its path points and the last line width, cap and style before it. */
function readStrokes(events: CanvasRenderingContext2DEvent[]): { strokes: Stroke[]; arrowTips: number[][] } {
  const state: Props = { lineCap: 'butt' };
  const strokes: Stroke[] = [];
  const arrowTips: number[][] = [];
  let transform: Props = {};
  for (const e of events) {
    if (['lineWidth', 'lineCap', 'strokeStyle'].includes(e.type)) {
      state[e.type] = props(e).value;
    } else if (e.type === 'setTransform') {
      transform = props(e);
    } else if (e.type === 'stroke' && transform.a === 1) {
      const path = (props(e).path as CanvasRenderingContext2DEvent[]).filter((p) => p.type !== 'beginPath');
      strokes.push({
        points: path.map((p) => [Math.round(props(p).x as number), Math.round(props(p).y as number)]),
        width: state.lineWidth,
        cap: state.lineCap,
        style: state.strokeStyle,
      });
    } else if (e.type === 'fill' && transform.a !== 1 && transform.a !== 8) {
      // An arrow: ECharts moves the canvas to the arrow tip.
      arrowTips.push([Math.round(transform.e as number), Math.round(transform.f as number)]);
    }
  }
  return { strokes, arrowTips };
}

describe('Geo route layer render', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('draws one line with round caps, width 5 and the dark green of the core defaults', () => {
    const { strokes, arrowTips } = readStrokes(draw([layer({})]));
    expect(strokes).toHaveLength(1);
    const [line] = strokes;
    expect(line.points).toHaveLength(3);
    expect(line.points[0]).toEqual([size / 2, size / 2]);
    expect(line).toMatchObject({ width: 5, cap: 'round' });
    expect(String(line.style).toLowerCase()).toBe(geoTheme.visualization.getColorByName('dark-green').toLowerCase());
    expect(arrowTips).toEqual([]);
  });

  it('draws each segment with flat caps and a forward arrow at its end', () => {
    const { strokes, arrowTips } = readStrokes(draw([layer({ arrow: 1 })]));
    expect(strokes.map((s) => s.points.length)).toEqual([2, 2]);
    expect(strokes.map((s) => s.cap)).toEqual(['butt', 'butt']);
    expect(arrowTips).toEqual(strokes.map((s) => s.points[1]));
  });

  it('draws a reverse arrow at the start of each segment', () => {
    const { strokes, arrowTips } = readStrokes(draw([layer({ arrow: -1 })]));
    expect(arrowTips).toEqual(strokes.map((s) => s.points[0]));
  });

  it('draws the width of the size field at the start of each segment', () => {
    const style = { size: { field: 'speed', fixed: 5, min: 2, max: 12 } };
    const { strokes } = readStrokes(draw([layer({ style })]));
    expect(strokes.map((s) => s.width)).toEqual([2, 7]);
    expect(strokes.map((s) => s.cap)).toEqual(['round', 'round']);
  });

  it('draws each segment of a color field as a gradient from its start color to its end color', () => {
    const style = { color: { field: 'speed', fixed: 'dark-green' } };
    const { strokes } = readStrokes(draw([layer({ style })]));
    expect(strokes).toHaveLength(2);
    // A gradient is a `CanvasGradient`, not a CSS color string.
    expect(strokes.map((s) => typeof s.style)).toEqual(['object', 'object']);
  });

  it('draws the route in the core layer order with a markers layer', () => {
    const markers = { type: 'markers', name: 'M', location: { mode: 'auto' }, config: {} };
    // The basemap square also draws `lineTo`, so only the order of the first markers and the last route counts.
    const markersOverRoute = draw([layer({}), markers]);
    const lastLine = markersOverRoute.map((e) => e.type).lastIndexOf('lineTo');
    const firstArc = markersOverRoute.map((e) => e.type).indexOf('arc');
    expect(firstArc).toBeGreaterThan(lastLine);
    const routeOverMarkers = draw([markers, layer({})]);
    expect(routeOverMarkers.map((e) => e.type).lastIndexOf('lineTo')).toBeGreaterThan(
      routeOverMarkers.map((e) => e.type).indexOf('arc')
    );
  });
});
