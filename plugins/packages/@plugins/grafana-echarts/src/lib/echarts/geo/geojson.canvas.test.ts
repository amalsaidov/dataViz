import { geoChartModule } from 'lib/echarts/charts/geo';
import { type ChartContext } from 'lib/echarts/charts/types';
import { setGeoJsonSource } from 'lib/grafana/geo/geojsonSource';
import { coordsFrame, geoContext, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, normalizeCanvasEvents, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The baseline of a GeoJSON layer under a markers layer on the small test basemap: a polygon with a hole, a line
// with the `stroke` properties, a point, and a style rule. `geojson.integration.test.ts` compares the styles with
// core Geomap.
const width = 256;
const height = 256;

const ring = (x0: number, y0: number, x1: number, y1: number) => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
  [x0, y0],
];

setGeoJsonSource('canvas-shapes.geojson', {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { name: 'area' },
      // The hole has the other winding (RFC 7946 section 3.1.6).
      geometry: { type: 'Polygon', coordinates: [ring(1, 1, 9, 9), ring(3, 7, 7, 3)] },
    },
    {
      type: 'Feature',
      properties: { name: 'road', stroke: '#ff9900', 'stroke-width': 3 },
      geometry: {
        type: 'LineString',
        coordinates: [
          [0, 5],
          [10, 6],
        ],
      },
    },
    { type: 'Feature', properties: { name: 'dot' }, geometry: { type: 'Point', coordinates: [8, 2] } },
  ],
});

describe('Geo GeoJSON canvas renders', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('a GeoJSON layer with a style rule under a markers layer', () => {
    const geojson = {
      type: 'geojson',
      name: 'G',
      config: {
        src: 'canvas-shapes.geojson',
        rules: [{ check: { property: 'name', operation: 'eq', value: 'dot' }, style: { color: { fixed: 'purple' } } }],
      },
    };
    const markers = {
      type: 'markers',
      name: 'M',
      location: { mode: 'auto' },
      config: { style: { color: { fixed: 'red' }, size: { fixed: 3 }, opacity: 1 } },
    };
    const ctx = geoContext([coordsFrame([[5, 5]])], {
      view: { id: 'coords', lat: 5, lon: 5, zoom: 3 },
      layers: [geojson, markers],
    } as Partial<ChartContext['options']>);
    const option = geoChartModule.buildOption(ctx, { isGrafanaLegend: true, plotWidth: width, plotHeight: height });
    const { dom, dispose } = renderGeo(option ?? {}, width, height);
    const events = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
    dispose();

    expect(normalizeCanvasEvents(events)).toMatchCanvasSnapshot([], { width, height });
  });
});
