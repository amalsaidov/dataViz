import { createDataFrame, FieldType } from '@grafana/data';
import { geoChartModule } from 'lib/echarts/charts/geo';
import { type ChartContext } from 'lib/echarts/charts/types';
import {
  captureZrenderCanvases,
  geoContext,
  inlineHeatmapDraws,
  readCanvasEvents,
  registerTestBasemap,
  renderGeo,
} from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, normalizeCanvasEvents, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The baseline of a heatmap layer under a markers layer on the small test basemap. The heatmap image shows as its
// point draws (`inlineHeatmapDraws`). `heatmap.integration.test.ts` compares the point
// geometry with core Geomap.
const width = 256;
const height = 256;

const frame = createDataFrame({
  fields: [
    { name: 'lat', type: FieldType.number, values: [5, 3, 6] },
    { name: 'lon', type: FieldType.number, values: [5, 3, 7] },
    { name: 'count', type: FieldType.number, values: [30, 10, 20] },
  ],
});

const context = (layers: object[]): ChartContext =>
  geoContext([frame], { view: { id: 'coords', lat: 5, lon: 5, zoom: 3 }, layers } as Partial<ChartContext['options']>);

const heatmap = {
  type: 'heatmap',
  name: 'Heat',
  location: { mode: 'auto' },
  config: { weight: { field: 'count', fixed: 1, min: 0, max: 1 }, radius: 16, blur: 6 },
};

describe('Geo heatmap canvas renders', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('a heatmap layer under a markers layer', () => {
    const markers = {
      type: 'markers',
      name: 'M',
      location: { mode: 'auto' },
      config: { style: { color: { fixed: 'red' }, size: { fixed: 3 }, opacity: 1 } },
    };
    const option = geoChartModule.buildOption(context([heatmap, markers]), {
      isGrafanaLegend: true,
      plotWidth: width,
      plotHeight: height,
    });
    const capture = captureZrenderCanvases();
    const { dom, dispose } = renderGeo(option ?? {}, width, height);
    capture.restore();
    const [heat, brush] = capture.canvases.map(readCanvasEvents);
    const events = inlineHeatmapDraws(readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR), heat, brush);
    dispose();

    expect(normalizeCanvasEvents(events)).toMatchCanvasSnapshot([], { width, height });
  });
});
