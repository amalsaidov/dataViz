import { geoChartModule } from 'lib/echarts/charts/geo';
import { coordsFrame, geoContext, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, normalizeCanvasEvents, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The baseline of the geo panel after one click of the zoom in button, on the small test basemap.
// `zoom.integration.test.tsx` tests the zoom against core.
const width = 128;
const height = 128;

describe('Geo zoom canvas renders', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('zoomed in one level', () => {
    const ctx = geoContext(
      [
        coordsFrame([
          [5, 5],
          [0, 0],
          [10, 10],
        ]),
      ],
      { view: { id: 'coords', lat: 5, lon: 5, zoom: 3 } }
    );
    const option = geoChartModule.buildOption(ctx, { isGrafanaLegend: true, plotWidth: width, plotHeight: height });
    const { dom, chart, dispose } = renderGeo(option ?? {}, width, height);
    const action = geoChartModule.getZoomAction?.(ctx);
    chart.dispatchAction({
      type: 'geoRoam',
      geoIndex: action?.geoIndex,
      zoom: action?.zoomStep,
      originX: width / 2,
      originY: height / 2,
    });
    chart.getZr().flush();
    const all = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
    const events = all.slice(all.map((e) => e.type).lastIndexOf('clearRect'));
    dispose();

    expect(normalizeCanvasEvents(events)).toMatchCanvasSnapshot([], { width, height });
  });
});
