import { type DataFrame, DataFrameType, FieldType, standardTransformersRegistry, toDataFrame } from '@grafana/data';
import { calculateHeatmapFrames, preloadHeatmapCalculator } from './calculate';

// The host's heatmap transformer is stood in by a fake that records its options.
// `standardTransformersRegistry` is empty in jest, so each test stubs `getIfExists`.
const binned = toDataFrame({
  meta: { type: DataFrameType.HeatmapCells },
  fields: [{ name: 'xMin', type: FieldType.time, values: [1] }],
});
const raw = [toDataFrame({ fields: [{ name: 'time', type: FieldType.time, values: [1] }] })];

function fakeInfo(transformer: (options: unknown) => (frames: DataFrame[]) => DataFrame[]) {
  return { id: 'heatmap', name: 'heatmap', operator: jest.fn(), transformer };
}

function stubRegistry(transformation: unknown) {
  jest
    .spyOn(standardTransformersRegistry, 'getIfExists')
    .mockReturnValue(transformation === undefined ? undefined : ({ transformation } as never));
}

describe('heatmap calculation via the host transformer', () => {
  afterEach(() => jest.restoreAllMocks());

  it('resolves a 13.1+ resolver entry and bins with core defaults and the time range', async () => {
    const transformer = jest.fn(() => () => [binned]);
    stubRegistry(() => Promise.resolve(fakeInfo(transformer)));
    await preloadHeatmapCalculator();

    const timeRange = { from: 1, to: 2 } as never;
    expect(calculateHeatmapFrames(raw, undefined, timeRange)).toEqual([binned]);
    expect(transformer).toHaveBeenCalledWith(
      {
        xBuckets: { mode: 'size' },
        yBuckets: { mode: 'size', scale: { type: 'linear' } },
        timeRange,
      },
      expect.anything()
    );
  });

  it('accepts the info object itself (hosts before 13.1)', async () => {
    stubRegistry(fakeInfo(() => () => [binned]));
    await preloadHeatmapCalculator();
    expect(calculateHeatmapFrames(raw, undefined)).toEqual([binned]);
  });

  it('returns undefined without a host transformer (standalone renderer)', async () => {
    stubRegistry(undefined);
    await preloadHeatmapCalculator();
    expect(calculateHeatmapFrames(raw, undefined)).toBeUndefined();
  });

  it('returns undefined when the resolver rejects', async () => {
    stubRegistry(() => Promise.reject(new Error('chunk failed')));
    await expect(preloadHeatmapCalculator()).resolves.toBeUndefined();
    expect(calculateHeatmapFrames(raw, undefined)).toBeUndefined();
  });

  it('returns undefined when core throws on unusable data', async () => {
    stubRegistry(
      fakeInfo(() => () => {
        throw 'no heatmap fields found';
      })
    );
    await preloadHeatmapCalculator();
    expect(calculateHeatmapFrames(raw, undefined)).toBeUndefined();
  });
});
