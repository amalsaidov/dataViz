import {
  buildHistogram,
  createTheme,
  type DataFrame,
  DataFrameType,
  FieldType,
  type HistogramTransformerOptions,
  toDataFrame,
} from '@grafana/data';
import { buildHistogramModel, isOrdinalHistogram, sanitizeHistogramOptions } from './histogram';

// The buckets must be the buckets of the core Histogram panel. The panel calls `buildHistogram` of
// `@grafana/data` for raw frames, and reads the bucket fields of a pre-bucketed frame.
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/HistogramPanel.tsx

const theme = createTheme();

const valuesFrame = (fields: Record<string, Array<number | null>>, refId = 'A'): DataFrame =>
  toDataFrame({
    refId,
    fields: [
      { name: 'time', type: FieldType.time, values: Object.values(fields)[0].map((_, i) => 1000 * i) },
      ...Object.entries(fields).map(([name, values]) => ({ name, type: FieldType.number, values })),
    ],
  });

/** The bounds and counts of a model, or of the core result, as plain arrays. */
const bucketsOf = (hist: {
  xMin: { values: unknown[] };
  xMax: { values: unknown[] };
  counts: Array<{ values: unknown[] }>;
}) => ({
  xMin: [...hist.xMin.values],
  xMax: [...hist.xMax.values],
  counts: hist.counts.map((field) => [...field.values]),
});

/** The buckets of core `buildHistogram` for the same frames and options. */
const coreBuckets = (frames: DataFrame[], options: HistogramTransformerOptions) => {
  const hist = buildHistogram(frames, options, theme);
  if (!hist) {
    throw new Error('core made no histogram');
  }
  return bucketsOf(hist);
};

const heights = [152, 158, 160, 161, 165, 168, 170, 171, 175, 180, 181, 190];

describe('buildHistogramModel', () => {
  it.each<[string, HistogramTransformerOptions]>([
    ['automatic buckets', {}],
    ['an explicit bucket size', { bucketSize: 10 }],
    ['a bucket count', { bucketCount: 4 }],
    ['a bucket offset', { bucketSize: 10, bucketOffset: 5 }],
    ['combined series', { bucketSize: 10, combine: true }],
  ])('makes the core buckets for %s', (_, options) => {
    const frames = [valuesFrame({ Height: heights, Weight: [60, 62, 70, 71, 72, 75, 80, 81, 82, 90, 95, 99] })];
    const model = buildHistogramModel(frames, options, theme);
    expect(model && bucketsOf(model)).toEqual(coreBuckets(frames, options));
  });

  it('gives the bounds and counts of an explicit bucket size', () => {
    const model = buildHistogramModel([valuesFrame({ Height: heights })], { bucketSize: 10 }, theme);
    expect(model && bucketsOf(model)).toEqual({
      xMin: [150, 160, 170, 180, 190],
      xMax: [160, 170, 180, 190, 200],
      counts: [[2, 4, 3, 2, 1]],
    });
  });

  it('makes no bucket for a range with no values, as core', () => {
    // 1 and 31 have 2 empty buckets between them. The x axis keeps the gap (see `buildHistogramOption`).
    const model = buildHistogramModel([valuesFrame({ A: [1, 31] })], { bucketSize: 10 }, theme);
    expect(model?.xMin.values).toEqual([0, 30]);
  });

  it('fills a count of 0 for a bucket that only the other series has', () => {
    const model = buildHistogramModel([valuesFrame({ A: [1, 2], B: [1, 25] })], { bucketSize: 10 }, theme);
    expect(model && bucketsOf(model).counts).toEqual([
      [2, 0],
      [1, 1],
    ]);
  });

  it('ignores null values, as core', () => {
    const frames = [valuesFrame({ A: [1, null, 12, null, 13] })];
    const model = buildHistogramModel(frames, { bucketSize: 10 }, theme);
    expect(model && bucketsOf(model)).toEqual(coreBuckets(frames, { bucketSize: 10 }));
    expect(model?.counts[0].values).toEqual([1, 2]);
  });

  it('makes one bucket for constant data', () => {
    const frames = [valuesFrame({ A: [5, 5, 5] })];
    const model = buildHistogramModel(frames, {}, theme);
    expect(model && bucketsOf(model)).toEqual(coreBuckets(frames, {}));
    expect(model?.counts[0].values).toEqual([3]);
  });

  it('buckets negative values below zero', () => {
    const frames = [valuesFrame({ A: [-15, -5, 5] })];
    const model = buildHistogramModel(frames, { bucketSize: 10 }, theme);
    expect(model?.xMin.values).toEqual([-20, -10, 0]);
  });

  it('buckets the numeric fields of several frames as several series', () => {
    const frames = [valuesFrame({ A: [1, 2, 11] }, 'A'), valuesFrame({ B: [3, 21] }, 'B')];
    const model = buildHistogramModel(frames, { bucketSize: 10 }, theme);
    expect(model && bucketsOf(model)).toEqual(coreBuckets(frames, { bucketSize: 10 }));
    expect(model?.names).toEqual(['A', 'B']);
  });

  it('names the combined series "Count", as core', () => {
    const model = buildHistogramModel([valuesFrame({ A: [1], B: [2] })], { combine: true }, theme);
    expect(model?.names).toEqual(['Count']);
  });

  it('draws the buckets of a pre-bucketed frame with no second bucketing', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.number, values: [0, 10, 20] },
        { name: 'xMax', type: FieldType.number, values: [10, 20, 30] },
        { name: 'count', type: FieldType.number, values: [4, 0, 7] },
      ],
    });
    const model = buildHistogramModel([frame], { bucketSize: 1 }, theme);
    expect(model && bucketsOf(model)).toEqual({ xMin: [0, 10, 20], xMax: [10, 20, 30], counts: [[4, 0, 7]] });
  });

  it('finds the upper bounds of a frame that has only lower bounds, as core', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.number, values: [0, 5, 10] },
        { name: 'count', type: FieldType.number, values: [1, 2, 3] },
      ],
    });
    expect(buildHistogramModel([frame], {}, theme)?.xMax.values).toEqual([5, 10, 15]);
  });

  it('does not change the input frames', () => {
    const frames = [valuesFrame({ A: [1, 2, 11] })];
    const before = JSON.stringify(frames);
    const states = frames[0].fields.map((field) => field.state);
    buildHistogramModel(frames, { bucketSize: 10 }, theme);
    expect(JSON.stringify(frames)).toBe(before);
    expect(frames[0].fields.map((field) => field.state)).toEqual(states);
  });

  it('gives no histogram for frames with no numeric field', () => {
    const frame = toDataFrame({ fields: [{ name: 'name', type: FieldType.string, values: ['a'] }] });
    expect(buildHistogramModel([frame], {}, theme)).toBeUndefined();
    expect(buildHistogramModel([], {}, theme)).toBeUndefined();
  });

  it('marks the named buckets of a heatmap-rows frame as ordinal', () => {
    const frame = toDataFrame({
      meta: { type: DataFrameType.HeatmapRows },
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: '0.1', type: FieldType.number, values: [1, 2] },
        { name: '1', type: FieldType.number, values: [3, 4] },
      ],
    });
    const model = buildHistogramModel([frame], {}, theme);
    expect(model && isOrdinalHistogram(model)).toBe(true);
  });
});

describe('sanitizeHistogramOptions', () => {
  it('keeps the values that buildHistogram can use', () => {
    expect(sanitizeHistogramOptions({ bucketCount: 10, bucketSize: 0.5, bucketOffset: -1, combine: true })).toEqual({
      bucketCount: 10,
      bucketSize: 0.5,
      bucketOffset: -1,
      combine: true,
    });
  });

  it('removes a bucket size or count that is not a positive number, so the automatic value applies', () => {
    expect(sanitizeHistogramOptions({ bucketCount: 0, bucketSize: -2, bucketOffset: Number.NaN })).toEqual({
      bucketCount: undefined,
      bucketSize: undefined,
      bucketOffset: undefined,
      combine: false,
    });
  });

  it('gives finite buckets for a bucket count of 0, where core gives none', () => {
    const frames = [valuesFrame({ A: [1, 2, 3] })];
    expect(coreBuckets(frames, { bucketCount: 0 }).xMin.every(Number.isFinite)).toBe(false);
    const model = buildHistogramModel(frames, { bucketCount: 0 }, theme);
    expect(model && bucketsOf(model)).toEqual(coreBuckets(frames, {}));
  });
});

describe('bucket options that are not valid', () => {
  // Core uses the automatic size for a negative size: `if (!bucketSize || bucketSize < 0)`.
  // https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/transformations/transformers/histogram.ts
  it('uses the core automatic size for a negative size', () => {
    const frames = [valuesFrame({ A: [1, 2, 3, 17, 40] })];
    expect(coreBuckets(frames, { bucketSize: -2 })).toEqual(coreBuckets(frames, {}));
    const model = buildHistogramModel(frames, { bucketSize: -2 }, theme);
    expect(model && bucketsOf(model)).toEqual(coreBuckets(frames, {}));
  });

  it.each<[string, HistogramTransformerOptions]>([
    ['a negative count', { bucketCount: -3 }],
    ['a count that is not finite', { bucketCount: Infinity }],
    ['a count that is NaN', { bucketCount: Number.NaN }],
    ['a size that is not finite', { bucketSize: Infinity }],
    ['a size that is text', { bucketSize: 'abc' } as unknown as HistogramTransformerOptions],
    ['an offset that is NaN', { bucketOffset: Number.NaN }],
    ['an offset that is not finite', { bucketOffset: -Infinity }],
    ['a negative size and a negative count', { bucketSize: -1, bucketCount: -1 }],
  ])('uses the automatic buckets for %s', (_, options) => {
    const frames = [valuesFrame({ A: [1, 2, 3, 17, 40] })];
    const model = buildHistogramModel(frames, options, theme);
    expect(model && bucketsOf(model)).toEqual(coreBuckets(frames, {}));
  });

  it('gives other buckets than core for a negative count, which core buckets with the smallest size', () => {
    const frames = [valuesFrame({ A: [1, 2, 3, 17, 40] })];
    expect(coreBuckets(frames, { bucketCount: -3 }).xMin.length).toBeGreaterThan(coreBuckets(frames, {}).xMin.length);
  });
});
