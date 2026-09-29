import { createDataFrame, createTheme, type DataFrame, FieldType } from '@grafana/data';
import { FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';
import { getMarkers, MARKERS_LAYER_TYPE } from './markers';
import { getBasemapStyle } from './style';

const theme = createTheme();

/** The `[lon, lat]` of each marker. */
const getMarkerPositions = (frames: DataFrame[], layers?: MapLayerOptions[]) =>
  getMarkers(frames, layers, theme).markers.map((m) => m.lonLat);

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
    expect(getMarkers([frame], layers, theme).markers.map((m) => m.size)).toEqual([2, 15]);
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

  it('reads the location of the first markers layer', () => {
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
