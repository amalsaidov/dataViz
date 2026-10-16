import { createDataFrame, createTheme, type DataFrame, FieldType } from '@grafana/data';
import { FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';
import { MARKERS_LAYER_TYPE } from './layers';
import { getMarkerLayers } from './markers';
import { getBasemapStyle } from './style';

const theme = createTheme();

/** The markers of the first markers layer, or no markers. */
const getMarkers = (frames: DataFrame[], layers?: MapLayerOptions[]) =>
  getMarkerLayers(frames, layers, theme)[0]?.markers ?? [];

/** The `[lon, lat]` of each marker of the first markers layer. */
const getMarkerPositions = (frames: DataFrame[], layers?: MapLayerOptions[]) =>
  getMarkers(frames, layers).map((m) => m.lonLat);

const coords = (lat: Array<number | null>, lon: Array<number | null>) =>
  createDataFrame({
    fields: [
      { name: 'lat', type: FieldType.number, values: lat },
      { name: 'lon', type: FieldType.number, values: lon },
    ],
  });

describe('getMarkers', () => {
  it('gives one [lon, lat] marker for each row with a position', () => {
    expect(getMarkerPositions([coords([51, null, -33.9], [0, 10, 151.2])])).toEqual([
      [0, 51],
      [151.2, -33.9],
    ]);
  });

  it('uses only the first frame, as core', () => {
    expect(getMarkerPositions([coords([1], [2]), coords([3], [4])])).toEqual([[2, 1]]);
  });

  it('uses the Auto location only when the layers option is unset, as core', () => {
    const frames = [coords([1], [2])];
    const heatmap = { type: 'heatmap', name: 'a', location: { mode: FrameGeometrySourceMode.Auto } } as MapLayerOptions;
    expect(getMarkerPositions(frames, undefined)).toEqual([[2, 1]]);
    expect(getMarkerPositions(frames, [])).toEqual([]);
    expect(getMarkerPositions(frames, [heatmap])).toEqual([]);
  });

  it('keeps a second marker at the same position with a different size, as core', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'lat', type: FieldType.number, values: [1, 1] },
        { name: 'lon', type: FieldType.number, values: [2, 2] },
        { name: 'v', type: FieldType.number, values: [1, 2] },
      ],
    });
    const layers = [
      { type: MARKERS_LAYER_TYPE, name: 'a', config: { style: { size: { field: 'v', fixed: 5, min: 2, max: 15 } } } },
    ] as MapLayerOptions[];
    expect(getMarkers([frame], layers).map((m) => m.size)).toEqual([2, 15]);
  });

  it('skips a second marker at the same position, as core', () => {
    expect(getMarkerPositions([coords([1, 1, 2], [2, 2, 2])])).toEqual([
      [2, 1],
      [2, 2],
    ]);
  });

  it('wraps the longitude to -180..180, where the repeated core world shows it', () => {
    expect(getMarkerPositions([coords([10, 10], [400, -190])])).toEqual([
      [40, 10],
      [170, 10],
    ]);
  });

  it('reads the location of the markers layer, not of a layer of an other type', () => {
    const frame = createDataFrame({
      fields: [
        { name: 'lat', type: FieldType.number, values: [1] },
        { name: 'lon', type: FieldType.number, values: [2] },
        { name: 'hash', type: FieldType.string, values: ['u4pruydqqvj'] },
      ],
    });
    const layers = [
      { type: 'heatmap', name: 'a', location: { mode: FrameGeometrySourceMode.Coords } },
      { type: MARKERS_LAYER_TYPE, name: 'b', location: { mode: FrameGeometrySourceMode.Geohash, geohash: 'hash' } },
    ] as MapLayerOptions[];
    const [marker] = getMarkerPositions([frame], layers);
    // Wikipedia geohash example: 57.64911, 10.40744.
    expect(marker[0]).toBeCloseTo(10.40744, 4);
    expect(marker[1]).toBeCloseTo(57.64911, 4);
  });

  it('gives the markers of each markers layer, in the layer order', () => {
    const frame = coords([1], [2]);
    const layers = [
      { type: MARKERS_LAYER_TYPE, name: 'a', config: { style: { color: { fixed: 'red' } } } },
      { type: 'heatmap', name: 'b' },
      { type: MARKERS_LAYER_TYPE, name: 'c', config: { style: { color: { fixed: 'blue' } } } },
    ] as MapLayerOptions[];
    const result = getMarkerLayers([frame], layers, theme);
    expect(result.map((l) => l.markers.map((m) => m.color))).toEqual([
      [theme.visualization.getColorByName('red')],
      [theme.visualization.getColorByName('blue')],
    ]);
  });

  it('gives each layer the first frame of its filterData query, as core', () => {
    const a = { ...coords([1], [2]), refId: 'A' };
    const b = { ...coords([3], [4]), refId: 'B' };
    const byRefId = (refId: string) => ({ id: 'byRefId', options: refId });
    const layers = [
      { type: MARKERS_LAYER_TYPE, name: 'a', filterData: byRefId('B') },
      { type: MARKERS_LAYER_TYPE, name: 'b' },
    ] as MapLayerOptions[];
    expect(getMarkerLayers([a, b], layers, theme, ['A', 'B']).map((l) => l.markers.map((m) => m.lonLat))).toEqual([
      [[4, 3]],
      [[2, 1]],
    ]);
  });

  it('gives no markers to a layer whose query returns no frame, as core', () => {
    const a = { ...coords([1], [2]), refId: 'A' };
    const layers = [
      { type: MARKERS_LAYER_TYPE, name: 'a', filterData: { id: 'byRefId', options: 'B' } },
    ] as MapLayerOptions[];
    expect(getMarkerLayers([a], layers, theme, ['A', 'B'])[0].markers).toEqual([]);
    // Query B is not in the panel: core ignores the filter.
    expect(getMarkerLayers([a], layers, theme, ['A'])[0].markers.map((m) => m.lonLat)).toEqual([[2, 1]]);
  });

  it('gives no markers for no frames or no location fields', () => {
    expect(getMarkerPositions([])).toEqual([]);
    expect(
      getMarkerPositions([createDataFrame({ fields: [{ name: 'v', type: FieldType.number, values: [1] }] })])
    ).toEqual([]);
  });
});

describe('geo styles', () => {
  it('gives the basemap theme colors', () => {
    expect(getBasemapStyle(theme)).toEqual({
      area: theme.colors.background.secondary,
      border: theme.colors.border.medium,
    });
  });
});

const getFirstLayer = (frames: DataFrame[], layers?: MapLayerOptions[]) => getMarkerLayers(frames, layers, theme)[0];
describe('getMarkers tooltip data', () => {
  it('gives the frame row of each marker, after the rows with no position', () => {
    const frame = coords([51, null, -33.9], [0, 10, 151.2]);
    const { markers, frame: markerFrame } = getFirstLayer([frame], undefined);
    expect(markers.map((m) => m.rowIndex)).toEqual([0, 2]);
    expect(markerFrame).toBe(frame);
  });

  it('shows the tooltip unless the layer sets tooltip false, as core', () => {
    const layer = (tooltip?: boolean) =>
      ({
        type: MARKERS_LAYER_TYPE,
        name: 'a',
        tooltip,
        location: { mode: FrameGeometrySourceMode.Auto },
      }) as MapLayerOptions;
    const frames = [coords([1], [2])];
    expect(getFirstLayer(frames, undefined).tooltip).toBe(true);
    expect(getFirstLayer(frames, [layer()]).tooltip).toBe(true);
    expect(getFirstLayer(frames, [layer(false)]).tooltip).toBe(false);
  });

  it('gives the layer name, or Layer 1 for a layer with no name, as core', () => {
    const frames = [coords([1], [2])];
    const named = { type: MARKERS_LAYER_TYPE, name: 'Cities', location: { mode: FrameGeometrySourceMode.Auto } };
    expect(getFirstLayer(frames, [named as MapLayerOptions]).name).toBe('Cities');
    expect(getFirstLayer(frames, undefined).name).toBe('Layer 1');
  });
});
