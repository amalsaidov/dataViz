import { createDataFrame, FieldType } from '@grafana/data';
import { type ChartContext } from 'lib/echarts/charts/types';
import { buildPanelChartOption } from 'lib/echarts/options/panelOption';
import { geoContext, registerTestBasemap, renderGeo } from 'test/geo';
import { DEFAULT_LAYER_SELECTOR, readCanvasLayer } from 'test/canvas';
import { registerGeoChart } from './chart';

// The drawn marker styles of the geo panel against core Geomap. Core draws the symbols with OpenLayers
// `WebGLPointsLayer` and the text with a `VectorImage` layer:
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/markersLayer.tsx
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/style/markers.ts (`getWebGLStyle`)
// The expected numbers are OpenLayers geometry. A Grafana 13.0.2 capture of core Geomap gives the same bounds.

interface Drawn {
  kind: 'shape' | 'text';
  /** The px points of the path, or the text anchor. */
  points: number[][];
  /** The arcs of the path: a circle symbol is one arc. */
  arcs: Array<{ center: number[]; radius: number }>;
  fill: string;
  text?: string;
  align?: string;
  baseline?: string;
}

const width = 400;
const height = 400;
// The view center is the marker position, so the marker is at the panel center.
const view = { view: { id: 'coords', lat: 0, lon: 0, zoom: 2 } };

/** Render the panel option, then read each filled arc, path and text in the draw order. */
function draw(ctx: ChartContext): Drawn[] {
  const option = buildPanelChartOption(ctx, { isGrafanaLegend: true, plotWidth: width, plotHeight: height });
  const { dom, dispose } = renderGeo(option ?? {}, width, height);
  const all = readCanvasLayer(dom, DEFAULT_LAYER_SELECTOR);
  const events = all.slice(all.map((e) => e.type).lastIndexOf('clearRect'));
  dispose();
  const drawn: Drawn[] = [];
  let m = { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 };
  const at = (x: number, y: number) => [m.a * x + m.c * y + m.e, m.b * x + m.d * y + m.f];
  let fill = '';
  let align = '';
  let baseline = '';
  let shape: Drawn | undefined;
  for (const event of events) {
    const p = event.props as Record<string, number & string>;
    switch (event.type) {
      case 'setTransform':
        m = { a: p.a, b: p.b, c: p.c, d: p.d, e: p.e, f: p.f };
        break;
      case 'fillStyle':
        fill = p.value;
        break;
      case 'textAlign':
        align = p.value;
        break;
      case 'textBaseline':
        baseline = p.value;
        break;
      case 'beginPath':
        shape = undefined;
        break;
      case 'arc':
        shape = shape ?? { kind: 'shape', points: [], arcs: [], fill };
        shape.arcs.push({ center: at(p.x, p.y), radius: Math.hypot(m.a, m.b) * p.radius });
        break;
      case 'moveTo':
      case 'lineTo':
      case 'bezierCurveTo':
        shape = shape ?? { kind: 'shape', points: [], arcs: [], fill };
        shape.points.push(at(p.x, p.y));
        break;
      case 'fill':
        if (shape) {
          drawn.push({ ...shape, fill });
        }
        break;
      case 'fillText':
        drawn.push({ kind: 'text', points: [at(p.x, p.y)], arcs: [], fill, text: p.text, align, baseline });
        break;
    }
  }
  // The basemap square is the first path; the test map is out of the marker box.
  // The first shape is the square of the test basemap.
  return drawn.slice(1);
}

const frame = createDataFrame({
  fields: [
    { name: 'lat', type: FieldType.number, values: [0] },
    { name: 'lon', type: FieldType.number, values: [0] },
    { name: 'heading', type: FieldType.number, values: [30] },
    { name: 'name', type: FieldType.string, values: ['Hello'] },
  ],
});

const markersLayer = (style: object) =>
  geoContext([frame], {
    ...view,
    layers: [{ type: 'markers', name: 'L', location: { mode: 'auto' }, config: { style } }],
  } as Partial<ChartContext['options']>);

const symbol = (name: string) => ({ mode: 'fixed', fixed: `img/icons/marker/${name}.svg` });

const bounds = (points: number[][]) => {
  const xs = points.map((p) => p[0]);
  const ys = points.map((p) => p[1]);
  return { left: Math.min(...xs), right: Math.max(...xs), top: Math.min(...ys), bottom: Math.max(...ys) };
};

describe('Geo marker styles render', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('draws a circle of radius size, at the alpha opacity * opacity, with no stroke of another color', () => {
    const [marker] = draw(markersLayer({ size: { fixed: 40 }, color: { fixed: '#ff0000' }, opacity: 0.5 }));

    // The core capture gives an 80 px circle of rgb(255, 191, 191) on white: alpha 0.25.
    expect(marker.fill).toBe('rgba(255, 0, 0, 0.25)');
    expect(marker.arcs).toHaveLength(1);
    expect(marker.arcs[0].radius).toBeCloseTo(40, 6);
    expect(marker.arcs[0].center[0]).toBeCloseTo(width / 2, 6);
    expect(marker.arcs[0].center[1]).toBeCloseTo(height / 2, 6);
  });

  it('draws a square of radius size, turned clockwise by the rotation', () => {
    const style = { size: { fixed: 40 }, symbol: symbol('square'), rotation: { fixed: 30 } };
    // The first two points are the corners of the symbol box.
    const [first, ...corners] = draw(markersLayer(style))[0].points.slice(2);
    // OpenLayers: the corner at -45° from the top, turned by 30° clockwise: -15° from the top.
    const angle = (-15 * Math.PI) / 180;
    expect(first[0]).toBeCloseTo(width / 2 + 40 * Math.sin(angle), 3);
    expect(first[1]).toBeCloseTo(height / 2 - 40 * Math.cos(angle), 3);
    expect(corners).toHaveLength(3);
  });

  it('draws a triangle with the top point size px above the position', () => {
    const [triangle] = draw(markersLayer({ size: { fixed: 40 }, symbol: symbol('triangle') }));
    const box = bounds(triangle.points.slice(2));

    // The core capture gives a triangle of 69 by 60 px, 40 px above and 20 px below the position.
    expect(box.top).toBeCloseTo(height / 2 - 40, 3);
    expect(box.bottom).toBeCloseTo(height / 2 + 20, 3);
    expect(box.right - box.left).toBeCloseTo(40 * Math.sqrt(3), 3);
  });

  it('draws an icon in a box of 2 * size px over a faint disc, and turns the offset of the alignment', () => {
    const style = {
      size: { fixed: 40 },
      color: { fixed: '#ff0000' },
      opacity: 0.5,
      symbol: symbol('plane'),
      rotation: { fixed: 45 },
      symbolAlign: { horizontal: 'left', vertical: 'top' },
    };
    const [disc, plane] = draw(markersLayer(style));
    // The offset is 40 px to the left and 40 px up, turned by 45° clockwise: 56.6 px up.
    const center = [width / 2, height / 2 - 40 * Math.SQRT2];

    expect(disc.fill).toBe('rgba(255, 0, 0, 0.05)');
    expect(disc.arcs[0].radius).toBeCloseTo(40, 6);
    expect(disc.arcs[0].center[0]).toBeCloseTo(center[0], 3);
    expect(disc.arcs[0].center[1]).toBeCloseTo(center[1], 3);
    // The first two points are the corners of the 24 by 24 icon box: (0, 0) and (24, 24), turned by 45°.
    const [a, b] = plane.points;
    expect((a[0] + b[0]) / 2).toBeCloseTo(center[0], 3);
    expect((a[1] + b[1]) / 2).toBeCloseTo(center[1], 3);
    expect(Math.hypot(b[0] - a[0], b[1] - a[1])).toBeCloseTo(80 * Math.SQRT2, 3);
    expect(b[0] - a[0]).toBeCloseTo(0, 3);
    expect(plane.fill).toBe('rgba(255, 0, 0, 0.25)');
  });

  it('draws the text under the symbol, at the px offset and alignment of the text config', () => {
    const style = {
      size: { fixed: 10 },
      color: { fixed: '#ff0000' },
      symbol: symbol('circle'),
      text: { mode: 'field', field: 'name' },
      textConfig: { fontSize: 20, textAlign: 'left', textBaseline: 'top', offsetX: 10, offsetY: 5 },
    };
    const [text, marker] = draw(markersLayer(style));

    expect(text).toMatchObject({ kind: 'text', text: 'Hello', fill: '#ff0000', align: 'left' });
    // zrender draws each line at its middle: the top of the 20 px line is 5 px below the position.
    expect(text.points[0][0]).toBeCloseTo(width / 2 + 10, 6);
    expect(text.points[0][1]).toBeCloseTo(height / 2 + 5 + 20 / 2, 6);
    expect(marker.arcs).toHaveLength(1);
  });

  it('draws the text only for a text and no symbol, as core', () => {
    const drawn = draw(markersLayer({ text: { mode: 'fixed', fixed: 'Hi' } }));

    expect(drawn.map((d) => d.kind)).toEqual(['text']);
  });
});
