import { createDataFrame, FieldType } from '@grafana/data';
import { type ChartContext } from 'lib/echarts/charts/types';
import { buildPanelChartOption } from 'lib/echarts/options/panelOption';
import { captureZrenderCanvases, geoContext, readCanvasEvents, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The drawn points of the heatmap layer against core Geomap. Core draws the layer with OpenLayers `Heatmap`: each
// point is a quad of `(radius + blur) * 2` px, with the alpha of the weight.
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/heatMap.tsx
// https://github.com/openlayers/openlayers/blob/main/src/ol/layer/Heatmap.js (`createRenderer`)

const size = 256;
// The view center is the first point, so that point is at the panel center.
const view = { id: 'coords', lat: 5, lon: 5, zoom: 3 };

interface Heat {
  /** The brush: the circle radius and the blur. */
  brush: { radius: number; blur: number };
  /** Each point draw: the alpha, the px center and the px size. */
  points: Array<{ alpha: number; center: [number, number]; size: number }>;
}

/** Render the panel option, then read the brush and the point draws of the heatmap canvas. */
function drawHeat(ctx: ChartContext): Heat {
  const capture = captureZrenderCanvases();
  const option = buildPanelChartOption(ctx, { isGrafanaLegend: true, plotWidth: size, plotHeight: size });
  const { dispose } = renderGeo(option ?? {}, size, size);
  capture.restore();
  const events = capture.canvases.map(readCanvasEvents);
  dispose();
  const props = (e: { props: unknown }) => e.props as Record<string, number>;
  const brushEvents = events.find((list) => list.some((e) => e.type === 'arc')) ?? [];
  const arc = props(brushEvents.find((e) => e.type === 'arc')!);
  const blur = props(brushEvents.find((e) => e.type === 'shadowBlur')!);
  const heatEvents = events.find((list) => list.some((e) => e.type === 'putImageData')) ?? [];
  const points: Heat['points'] = [];
  let alpha = 1;
  for (const e of heatEvents) {
    if (e.type === 'globalAlpha') {
      alpha = props(e).value;
    } else if (e.type === 'drawImage') {
      const { dx, dy, dWidth } = props(e);
      points.push({ alpha, center: [dx + dWidth / 2, dy + dWidth / 2], size: dWidth });
    }
  }
  return { brush: { radius: arc.radius, blur: blur.value }, points };
}

const layer = (config: object) => ({ type: 'heatmap', name: 'H', location: { mode: 'auto' }, config });
const frame = createDataFrame({
  fields: [
    { name: 'lat', type: FieldType.number, values: [5, 2] },
    { name: 'lon', type: FieldType.number, values: [5, 2] },
    { name: 'count', type: FieldType.number, values: [30, 10] },
  ],
});
const context = (layers: object[]) => geoContext([frame], { view, layers } as Partial<ChartContext['options']>);

describe('Geo heatmap layer render', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('draws each point as a quad of (radius + blur) * 2 px with the core defaults, as OpenLayers', () => {
    const heat = drawHeat(context([layer({})]));
    expect(heat.brush).toEqual({ radius: 5, blur: 15 });
    expect(heat.points.map((p) => p.size)).toEqual([40, 40]);
    // The fixed weight 1 gives the full alpha.
    expect(heat.points.map((p) => p.alpha)).toEqual([1, 1]);
    expect(heat.points[0].center.map(Math.round)).toEqual([size / 2, size / 2]);
  });

  it('draws the radius and the blur of the layer config', () => {
    const heat = drawHeat(context([layer({ radius: 20, blur: 4 })]));
    expect(heat.brush).toEqual({ radius: 20, blur: 4 });
    expect(heat.points[0].size).toBe(48);
  });

  it('gives each point the alpha of its scaled weight', () => {
    const heat = drawHeat(context([layer({ weight: { field: 'count', fixed: 1, min: 0.2, max: 1 } })]));
    expect(heat.points.map((p) => p.alpha)).toEqual([1, 0.2]);
  });

  it('draws the heatmap in the core layer order with the markers layers', () => {
    const markers = { type: 'markers', name: 'M', location: { mode: 'auto' }, config: {} };
    // The panel canvas gets the heatmap as one image. The markers are arcs.
    const order = (layers: object[]) => {
      const option = buildPanelChartOption(context(layers), {
        isGrafanaLegend: true,
        plotWidth: size,
        plotHeight: size,
      });
      const { dom, dispose } = renderGeo(option ?? {}, size, size);
      const events = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
      dispose();
      return events.flatMap((e) => (e.type === 'arc' ? ['markers'] : e.type === 'drawImage' ? ['heatmap'] : []));
    };
    expect([...new Set(order([layer({}), markers]))]).toEqual(['heatmap', 'markers']);
    expect([...new Set(order([markers, layer({})]))]).toEqual(['markers', 'heatmap']);
  });
});
