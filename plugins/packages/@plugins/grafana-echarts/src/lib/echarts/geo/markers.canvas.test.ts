import { createDataFrame, FieldType, ThresholdsMode } from '@grafana/data';
import { geoChartModule } from 'lib/echarts/charts/geo';
import { type ChartContext } from 'lib/echarts/charts/types';
import { coordsFrame, geoContext, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, normalizeCanvasEvents, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The baselines of the geo panel render on a small test basemap: markers of the core default style, and markers
// with the style dimensions. `markers.integration.test.ts` and `styles.integration.test.ts` test the marker count,
// the positions and the styles.
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

  it('style dimensions: size and color from fields, a turned square, and text', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'lat', type: FieldType.number, values: [2, 5, 8] },
        { name: 'lon', type: FieldType.number, values: [2, 5, 8] },
        {
          name: 'value',
          type: FieldType.number,
          values: [10, 50, 90],
          // The Grafana default thresholds, as the panel field config gives them.
          config: {
            thresholds: {
              mode: ThresholdsMode.Absolute,
              steps: [
                { value: -Infinity, color: 'green' },
                { value: 80, color: 'red' },
              ],
            },
          },
        },
        { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
      ],
    });
    const style = {
      size: { field: 'value', fixed: 5, min: 4, max: 10 },
      color: { field: 'value', fixed: 'dark-green' },
      opacity: 0.8,
      symbol: { mode: 'fixed', fixed: 'img/icons/marker/square.svg' },
      rotation: { fixed: 20, mode: 'mod', min: -360, max: 360 },
      text: { mode: 'field', field: 'name' },
      textConfig: { fontSize: 10, textAlign: 'left', textBaseline: 'middle', offsetX: 12, offsetY: 0 },
    };
    const ctx = geoContext([frame], {
      view: { id: 'coords', lat: 5, lon: 5, zoom: 3 },
      layers: [{ type: 'markers', name: 'L', location: { mode: 'auto' }, config: { style } }],
    } as Partial<ChartContext['options']>);
    const option = geoChartModule.buildOption(ctx, { isGrafanaLegend: true, plotWidth: width, plotHeight: height });
    const { dom, dispose } = renderGeo(option ?? {}, width, height);
    const events = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
    dispose();

    expect(normalizeCanvasEvents(events)).toMatchCanvasSnapshot([], { width, height });
  });
});
