import { createDataFrame, FieldColorModeId, FieldType } from '@grafana/data';
import { geoChartModule } from 'lib/echarts/charts/geo';
import { type ChartContext } from 'lib/echarts/charts/types';
import { geoContext, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, normalizeCanvasEvents, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The baselines of the route layer on the small test basemap. `route.integration.test.ts` compares the drawn line
// with core Geomap.
const width = 256;
const height = 256;

const frame = createDataFrame({
  fields: [
    { name: 'lat', type: FieldType.number, values: [4, 5, 7, 6] },
    { name: 'lon', type: FieldType.number, values: [3, 5, 6, 8] },
    {
      name: 'speed',
      type: FieldType.number,
      values: [0, 10, 20, 30],
      config: { color: { mode: FieldColorModeId.ContinuousGrYlRd } },
    },
  ],
});

const render = (config: object) => {
  const route = { type: 'route', name: 'Route', location: { mode: 'auto' }, config };
  const ctx: ChartContext = geoContext([frame], {
    view: { id: 'coords', lat: 5, lon: 5, zoom: 3 },
    layers: [route],
  } as Partial<ChartContext['options']>);
  const option = geoChartModule.buildOption(ctx, { isGrafanaLegend: true, plotWidth: width, plotHeight: height });
  const { dom, dispose } = renderGeo(option ?? {}, width, height);
  const events = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
  dispose();
  return normalizeCanvasEvents(events);
};

describe('Geo route canvas renders', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('a route with the core default style', () => {
    expect(render({})).toMatchCanvasSnapshot([], { width, height });
  });

  it('a route with a color field, a size field and forward arrows', () => {
    const style = {
      color: { field: 'speed', fixed: 'dark-green' },
      size: { field: 'speed', fixed: 5, min: 2, max: 8 },
      opacity: 1,
    };
    expect(render({ style, arrow: 1 })).toMatchCanvasSnapshot([], { width, height });
  });
});
