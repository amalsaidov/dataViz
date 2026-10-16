import { createDataFrame, FieldColorModeId, FieldType } from '@grafana/data';
import { FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';
import { coordsFrame, geoTheme } from 'test/geo';
import { DEFAULT_HEATMAP_COLORS, getHeatmapLayers } from './heatmap';

const heatmap = (config: object = {}, extra: Partial<MapLayerOptions> = {}): MapLayerOptions => ({
  type: 'heatmap',
  name: 'H',
  location: { mode: FrameGeometrySourceMode.Auto },
  config,
  ...extra,
});

const weighted = createDataFrame({
  fields: [
    { name: 'lat', type: FieldType.number, values: [1, 2, 3] },
    { name: 'lon', type: FieldType.number, values: [1, 2, 400] },
    { name: 'count', type: FieldType.number, values: [10, 20, 30] },
  ],
});

describe('getHeatmapLayers', () => {
  it('uses the core defaults: weight 1, radius 5, blur 15 and the core gradient', () => {
    const [layer] = getHeatmapLayers([coordsFrame([[1, 2]])], [heatmap()], geoTheme);
    expect(layer).toEqual({
      points: [{ lonLat: [2, 1], weight: 1 }],
      radius: 5,
      blur: 15,
      colors: DEFAULT_HEATMAP_COLORS,
      layerIndex: 0,
    });
  });

  it('scales the weight field from min to max, and wraps the longitude as the markers', () => {
    const [layer] = getHeatmapLayers(
      [weighted],
      [heatmap({ weight: { field: 'count', fixed: 1, min: 0, max: 1 }, radius: 20, blur: 3 })],
      geoTheme
    );
    expect(layer.points).toEqual([
      { lonLat: [1, 1], weight: 0 },
      { lonLat: [2, 2], weight: 0.5 },
      { lonLat: [40, 3], weight: 1 },
    ]);
    expect([layer.radius, layer.blur]).toEqual([20, 3]);
  });

  it('clamps a fixed weight to 0 to 1, as OpenLayers', () => {
    const [layer] = getHeatmapLayers(
      [coordsFrame([[1, 2]])],
      [heatmap({ weight: { fixed: 4, min: 0, max: 1 } })],
      geoTheme
    );
    expect(layer.points[0].weight).toBe(1);
  });

  it('takes the gradient of a continuous color scheme of the first number field', () => {
    const frame = createDataFrame({
      fields: [
        {
          name: 'lat',
          type: FieldType.number,
          values: [1],
          config: { color: { mode: FieldColorModeId.ContinuousGrYlRd } },
        },
        { name: 'lon', type: FieldType.number, values: [1] },
      ],
    });
    const [layer] = getHeatmapLayers([frame], [heatmap()], geoTheme);
    expect(layer.colors).not.toEqual(DEFAULT_HEATMAP_COLORS);
    expect(layer.colors.length).toBeGreaterThan(1);
  });

  it('gives the index of each heatmap layer in the full layer list, and skips the markers layers', () => {
    const markers: MapLayerOptions = { type: 'markers', name: 'M', config: {} };
    const layers = getHeatmapLayers([coordsFrame([[1, 1]])], [markers, heatmap()], geoTheme);
    expect(layers.map((l) => l.layerIndex)).toEqual([1]);
  });

  it('uses the first frame of the layer query, and no points when the query has no frame', () => {
    const a = { ...coordsFrame([[1, 1]]), refId: 'A' };
    const b = { ...coordsFrame([[2, 2]]), refId: 'B' };
    const byRef = (refId: string) => heatmap({}, { filterData: { id: 'byRefId', options: refId } });
    const [fromB, fromC] = getHeatmapLayers([a, b], [byRef('B'), byRef('C')], geoTheme, ['A', 'B', 'C']);
    expect(fromB.points.map((p) => p.lonLat)).toEqual([[2, 2]]);
    expect(fromC.points).toEqual([]);
  });
});
