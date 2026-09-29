import { geoChartModule } from 'lib/echarts/charts/geo';
import { type ChartContext } from 'lib/echarts/charts/types';
import { coordsFrame, geoContext, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, normalizeCanvasEvents, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The baseline of two markers layers on the small test basemap. `layers.integration.test.ts` tests the draw order
// and the frames of each layer.
const width = 128;
const height = 128;

describe('Geo layers canvas renders', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('two markers layers: the second layer on top, from its own query', () => {
    const a = {
      ...coordsFrame([
        [5, 5],
        [2, 2],
      ]),
      refId: 'A',
    };
    const b = {
      ...coordsFrame([
        [5, 6],
        [8, 8],
      ]),
      refId: 'B',
    };
    const style = (color: string, size: number) => ({ color: { fixed: color }, size: { fixed: size }, opacity: 0.8 });
    const ctx = geoContext([a, b], {
      view: { id: 'coords', lat: 5, lon: 5, zoom: 3 },
      layers: [
        { type: 'markers', name: 'Layer 1', location: { mode: 'auto' }, config: { style: style('red', 8) } },
        {
          type: 'markers',
          name: 'Layer 2',
          location: { mode: 'auto' },
          filterData: { id: 'byRefId', options: 'B' },
          config: { style: style('blue', 5) },
        },
      ],
    } as Partial<ChartContext['options']>);
    const option = geoChartModule.buildOption(ctx, { isGrafanaLegend: true, plotWidth: width, plotHeight: height });
    const { dom, dispose } = renderGeo(option ?? {}, width, height);
    const events = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
    dispose();

    expect(normalizeCanvasEvents(events)).toMatchCanvasSnapshot([], { width, height });
  });
});
