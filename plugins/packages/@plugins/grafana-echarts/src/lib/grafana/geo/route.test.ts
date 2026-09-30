import { createDataFrame, FieldType } from '@grafana/data';
import { FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';
import { coordsFrame, geoTheme } from 'test/geo';
import { getRouteLayers } from './route';

const route = (config: object = {}, extra: Partial<MapLayerOptions> = {}): MapLayerOptions => ({
  type: 'route',
  name: 'R',
  location: { mode: FrameGeometrySourceMode.Auto },
  config,
  ...extra,
});

const green = geoTheme.visualization.getColorByName('dark-green');

describe('getRouteLayers', () => {
  it('uses the core defaults: one line, width 5 (size.fixed), opacity 1, dark green, no arrow', () => {
    const [layer] = getRouteLayers(
      [
        coordsFrame([
          [1, 2],
          [3, 4],
        ]),
      ],
      [route()],
      geoTheme
    );
    expect(layer).toMatchObject({ segments: false, arrow: 0, layerIndex: 0 });
    expect(layer.points.map((p) => p.lonLat)).toEqual([
      [2, 1],
      [4, 3],
    ]);
    expect(new Set(layer.points.map((p) => p.width))).toEqual(new Set([5]));
    // The theme dark-green with the alpha of opacity 1.
    expect(layer.points[0].color).toBe(`${green}ff`);
  });

  it('uses lineWidth for one line when size.fixed is 0, as core getStrokeStyle', () => {
    const [layer] = getRouteLayers(
      [
        coordsFrame([
          [1, 2],
          [3, 4],
        ]),
      ],
      [route({ style: { size: { fixed: 0, min: 2, max: 15 }, lineWidth: 7 } })],
      geoTheme
    );
    expect(layer.points[0].width).toBe(7);
  });

  it('draws segments for an arrow, and sets the alpha of the color to the opacity', () => {
    const [layer] = getRouteLayers(
      [
        coordsFrame([
          [1, 2],
          [3, 4],
        ]),
      ],
      [route({ arrow: -1, style: { opacity: 0.5, color: { fixed: '#ff0000' } } })],
      geoTheme
    );
    expect(layer).toMatchObject({ segments: true, arrow: -1 });
    expect(layer.points[0].color).toBe('#ff000080');
  });

  it('gives each point the size of its row for a size field', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'lat', type: FieldType.number, values: [1, 2, 3] },
        { name: 'lon', type: FieldType.number, values: [1, 2, 3] },
        { name: 'speed', type: FieldType.number, values: [0, 5, 10] },
      ],
    });
    const [layer] = getRouteLayers(
      [frame],
      [route({ style: { size: { field: 'speed', fixed: 5, min: 2, max: 12 } } })],
      geoTheme
    );
    expect(layer.segments).toBe(true);
    expect(layer.points.map((p) => p.width)).toEqual([2, 7, 12]);
  });

  it('skips a row with no position, and draws no line for fewer than 2 points, as core', () => {
    const [two] = getRouteLayers(
      [
        coordsFrame([
          [1, 1],
          [null, null],
          [2, 2],
        ]),
      ],
      [route()],
      geoTheme
    );
    expect(two.points.map((p) => p.lonLat)).toEqual([
      [1, 1],
      [2, 2],
    ]);
    const [one] = getRouteLayers(
      [
        coordsFrame([
          [1, 1],
          [null, null],
        ]),
      ],
      [route()],
      geoTheme
    );
    expect(one.points).toEqual([]);
  });

  it('gives the index of each route layer in the full layer list, and uses the first frame only', () => {
    const markers: MapLayerOptions = { type: 'markers', name: 'M', config: {} };
    const layers = getRouteLayers(
      [
        coordsFrame([
          [1, 1],
          [2, 2],
        ]),
        coordsFrame([
          [5, 5],
          [6, 6],
        ]),
      ],
      [markers, route()],
      geoTheme
    );
    expect(layers.map((l) => l.layerIndex)).toEqual([1]);
    expect(layers[0].points[0].lonLat).toEqual([1, 1]);
  });
});
