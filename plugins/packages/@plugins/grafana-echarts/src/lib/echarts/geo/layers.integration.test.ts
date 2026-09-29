import { type ChartContext } from 'lib/echarts/charts/types';
import { buildPanelChartOption } from 'lib/echarts/options/panelOption';
import { coordsFrame, geoContext, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The drawn markers of more than one core markers layer. Core draws each layer over the layers before it, and a
// layer with a `filterData` query uses the first frame of that query.
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/GeomapPanel.tsx

type Drawn = { kind: 'arc' | 'text'; x: number; y: number; fill: string; text?: string };

/** Render the panel option and read each drawn circle and text, in the draw order. */
function draw(ctx: ChartContext): Drawn[] {
  const size = 256;
  const option = buildPanelChartOption(ctx, { isGrafanaLegend: true, plotWidth: size, plotHeight: size });
  const { dom, dispose } = renderGeo(option ?? {}, size, size);
  const all = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
  dispose();
  const drawn: Drawn[] = [];
  let transform = { e: 0, f: 0 };
  let fill = '';
  for (const event of all.slice(all.map((e) => e.type).lastIndexOf('clearRect'))) {
    const props = event.props as Record<string, number & string>;
    if (event.type === 'setTransform') {
      transform = { e: props.e, f: props.f };
    } else if (event.type === 'fillStyle') {
      fill = props.value;
    } else if (event.type === 'arc') {
      drawn.push({ kind: 'arc', x: transform.e, y: transform.f, fill });
    } else if (event.type === 'fillText') {
      drawn.push({ kind: 'text', x: transform.e, y: transform.f, fill, text: props.text });
    }
  }
  return drawn;
}

const view = { id: 'coords', lat: 5, lon: 5, zoom: 3 };
const markersLayer = (name: string, color: string, extra: object = {}) => ({
  type: 'markers',
  name,
  location: { mode: 'auto' },
  config: { style: { color: { fixed: color }, opacity: 1 } },
  ...extra,
});
const options = (layers: object[]) => ({ view, layers }) as Partial<ChartContext['options']>;

describe('Geo layers render', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  const frame = coordsFrame([[5, 5]]);

  it('draws each markers layer, the last layer on top, as core', () => {
    const drawn = draw(geoContext([frame], options([markersLayer('a', '#ff0000'), markersLayer('b', '#0000ff')])));
    expect(drawn.map((d) => d.fill)).toEqual(['#ff0000', '#0000ff']);
    // Both layers draw the same marker at the same position.
    expect(drawn[0].x).toBe(drawn[1].x);
    expect(drawn[0].y).toBe(drawn[1].y);
  });

  it('draws the layers in the new order after a move', () => {
    const drawn = draw(geoContext([frame], options([markersLayer('b', '#0000ff'), markersLayer('a', '#ff0000')])));
    expect(drawn.map((d) => d.fill)).toEqual(['#0000ff', '#ff0000']);
  });

  it('draws the text of a layer under the symbols of the next layer', () => {
    // A text layer draws its symbols only when the style has a symbol, as core.
    const text = {
      text: { mode: 'fixed', fixed: 'hi' },
      textConfig: { fontSize: 10 },
      symbol: { mode: 'fixed', fixed: 'img/icons/marker/circle.svg' },
    };
    const withText = (name: string, color: string, refId: string) => {
      const layer = markersLayer(name, color, { filterData: { id: 'byRefId', options: refId } });
      layer.config.style = { ...layer.config.style, ...text };
      return layer;
    };
    // Two positions: ECharts hides a text that overlaps another text (`hideOverlap`).
    const frames = [
      { ...coordsFrame([[5, 5]]), refId: 'A' },
      { ...coordsFrame([[5, 8]]), refId: 'B' },
    ];
    const drawn = draw(geoContext(frames, options([withText('a', '#ff0000', 'A'), withText('b', '#0000ff', 'B')])));
    // In each layer the text is under the symbols. All of layer `b` is over all of layer `a`.
    expect(drawn.map((d) => `${d.kind} ${d.fill}`)).toEqual([
      'text #ff0000',
      'arc #ff0000',
      'text #0000ff',
      'arc #0000ff',
    ]);
  });

  it('draws a layer from the first frame of its filterData query', () => {
    const a = { ...coordsFrame([[2, 2]]), refId: 'A' };
    const b = { ...coordsFrame([[8, 8]]), refId: 'B' };
    const layers = [
      markersLayer('a', '#ff0000'),
      markersLayer('b', '#0000ff', { filterData: { id: 'byRefId', options: 'B' } }),
    ];
    const [first, second] = draw(geoContext([a, b], options(layers)));
    // Layer `a` has no query: it draws the first frame (A). Layer `b` draws B, up and to the right of A.
    expect(second.x).toBeGreaterThan(first.x);
    expect(second.y).toBeLessThan(first.y);
    // The same layer alone, with no query, draws A at the position of `first`.
    const [alone] = draw(geoContext([a, b], options([markersLayer('b', '#0000ff')])));
    expect([alone.x, alone.y]).toEqual([first.x, first.y]);
  });
});
