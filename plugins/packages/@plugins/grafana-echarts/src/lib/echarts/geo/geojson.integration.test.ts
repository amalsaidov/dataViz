import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { type ChartContext } from 'lib/echarts/charts/types';
import { buildPanelChartOption } from 'lib/echarts/options/panelOption';
import { setGeoJsonSource } from 'lib/grafana/geo/geojsonSource';
import { geoContext, geoTheme, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The drawn shapes of the GeoJSON layer against core Geomap. Core draws each feature with the OpenLayers style of
// `polyStyle` or `circleMarker`: the fill has the color with the style opacity as alpha, and the stroke has the
// color with a width of `lineWidth` (default 1). A point is a circle of radius `size` (default 5).
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/geojsonLayer.ts
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/style/markers.ts

const size = 256;
// The view center is the point, so the point is at the panel center.
const view = { id: 'coords', lat: 5, lon: 5, zoom: 3 };

setGeoJsonSource('test-shapes.geojson', {
  type: 'FeatureCollection',
  features: [
    {
      type: 'Feature',
      properties: { kind: 'area' },
      geometry: {
        type: 'Polygon',
        coordinates: [
          [
            [2, 2],
            [8, 2],
            [8, 8],
            [2, 8],
            [2, 2],
          ],
        ],
      },
    },
    { type: 'Feature', properties: { kind: 'dot' }, geometry: { type: 'Point', coordinates: [5, 5] } },
  ],
});

const layer = (config: object) => ({ type: 'geojson', name: 'G', config: { src: 'test-shapes.geojson', ...config } });
const context = (config: object) =>
  geoContext([], { view, layers: [layer(config)] } as Partial<ChartContext['options']>);

/** The canvas draw calls of the panel. */
function draw(ctx: ChartContext): CanvasRenderingContext2DEvent[] {
  const option = buildPanelChartOption(ctx, { isGrafanaLegend: true, plotWidth: size, plotHeight: size });
  const { dom, dispose } = renderGeo(option ?? {}, size, size);
  const events = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
  dispose();
  return events;
}

const values = (events: CanvasRenderingContext2DEvent[], type: string) =>
  events.filter((e) => e.type === type).map((e) => (e.props as { value: unknown }).value);
const arcs = (events: CanvasRenderingContext2DEvent[]) =>
  events.filter((e) => e.type === 'arc').map((e) => e.props as { x: number; y: number; radius: number });

describe('Geo GeoJSON layer render', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('draws the core default style: dark green, a fill alpha of 0.4, a line width of 1 and a point radius of 5', () => {
    const events = draw(context({}));
    const green = geoTheme.visualization.getColorByName('dark-green');
    expect(values(events, 'fillStyle')).toContain('rgba(55, 135, 45, 0.4)');
    expect(values(events, 'strokeStyle')).toContain(green.toLowerCase());
    expect(values(events, 'lineWidth')).toContain(1);
    const [dot] = arcs(events);
    expect(dot.radius).toBe(5);
    expect([dot.x, dot.y].map(Math.round)).toEqual([size / 2, size / 2]);
  });

  it('draws the rule style for the features that match, and the default style for the others', () => {
    const rules = [
      {
        check: { property: 'kind', operation: 'eq', value: 'dot' },
        style: { color: { fixed: '#ff0000' }, opacity: 1 },
      },
    ];
    const events = draw(context({ rules, style: { color: { fixed: '#0000ff' }, opacity: 0.5, lineWidth: 2 } }));
    expect(values(events, 'fillStyle')).toEqual(expect.arrayContaining(['rgba(0, 0, 255, 0.5)', '#ff0000']));
    expect(values(events, 'lineWidth')).toContain(2);
  });

  it('draws no fill for an opacity of 0', () => {
    const events = draw(context({ style: { color: { fixed: '#0000ff' }, opacity: 0 } }));
    expect(values(events, 'fillStyle').some((v) => String(v).includes('0, 0, 255'))).toBe(false);
    expect(values(events, 'strokeStyle')).toContain('#0000ff');
  });

  it('draws the features of the default src from the basemap countries', () => {
    const events = draw(
      geoContext([], { view, layers: [{ type: 'geojson', name: 'C' }] } as Partial<ChartContext['options']>)
    );
    expect(values(events, 'fillStyle')).toContain('rgba(55, 135, 45, 0.4)');
  });
});
