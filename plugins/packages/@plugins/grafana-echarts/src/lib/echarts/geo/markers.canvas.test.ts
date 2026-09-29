import { geoChartModule } from 'lib/echarts/charts/geo';
import { coordsFrame, geoContext, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, normalizeCanvasEvents, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The baseline of the geo panel render: markers of the core default style on a small test basemap.
// `markers.integration.test.ts` tests the marker count, the positions and the style.
const width = 128;
const height = 128;

describe('Geo markers canvas renders', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('fixed style markers', () => {
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
    const { dom, dispose } = renderGeo(option ?? {}, width, height);
    const events = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
    dispose();

    expect(normalizeCanvasEvents(events)).toMatchCanvasSnapshot([], { width, height });
  });
});
