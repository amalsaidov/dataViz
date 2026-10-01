import {
  createTheme,
  dateTime,
  type DataFrame,
  FieldType,
  type TimeRange,
  toDataFrame,
  type ValueFormatter,
} from '@grafana/data';
import { seriesTypePath } from 'editor/constants';
import { type MultiValueSeriesType } from 'editor/types';
import { type ChartContext } from 'lib/echarts/charts/types';
import { cartesianChartModule } from 'lib/echarts/charts/cartesian';
import {
  framesLookMultiValue,
  CANDLESTICK_ISSUE_MESSAGES,
  BOXPLOT_ISSUE_MESSAGES,
  getBoxplotDataIssue,
  getCandlestickDataIssue,
  multiValueCartesianToEChartsOption,
  resolveMultiValueSeriesType,
} from 'lib/echarts/converters/multiValueCartesian';
import { type PanelOptions } from 'types';

const theme = createTheme();

const formatValue: ValueFormatter = (value) => ({ text: value == null ? '' : String(value) });

/** Absolute time range from epoch-ms bounds, matching what the panel passes in. */
const timeRange = (from: number, to: number): TimeRange => ({
  from: dateTime(from),
  to: dateTime(to),
  raw: { from: dateTime(from), to: dateTime(to) },
});

// Wide default range that covers every fixture row (candlestick rows sit at
// t=0 and t=60_000), so a test only narrows it when it asserts range filtering.
const fullRange = timeRange(0, 60_000);

/** Build a minimal ChartContext for the multi-value converter under test. */
const makeContext = (
  frames: DataFrame[],
  seriesType: MultiValueSeriesType,
  range: TimeRange = fullRange
): ChartContext<MultiValueSeriesType> => ({
  frames,
  theme,
  timeZone: 'utc',
  timeRange: range,
  options: { [seriesTypePath]: seriesType } as PanelOptions,
  seriesType,
  formatValue,
  replaceVariables: (value: string) => value,
  fieldConfig: { defaults: {}, overrides: [] },
});

/** Run the converter, normalizing the ECharts `Arrayable` series into an array. */
const run = (frames: DataFrame[], seriesType: MultiValueSeriesType, range?: TimeRange) => {
  const result = multiValueCartesianToEChartsOption(makeContext(frames, seriesType, range));
  if (result === null) {
    return null;
  }

  const { categories, series } = result;
  if (!Array.isArray(series)) {
    throw new Error('Narrow series to array');
  }

  return { categories, series };
};

const ohlcFrame = (fieldNames = ['open', 'high', 'low', 'close']): DataFrame =>
  toDataFrame({
    name: 'BTC',
    fields: [
      { name: 'time', type: FieldType.time, values: [0, 60_000] },
      { name: fieldNames[0], type: FieldType.number, values: [10, 15] },
      { name: fieldNames[1], type: FieldType.number, values: [20, 25] },
      { name: fieldNames[2], type: FieldType.number, values: [5, 12] },
      { name: fieldNames[3], type: FieldType.number, values: [18, 22] },
    ],
  });

describe('multiValueCartesianToEChartsOption', () => {
  describe('candlestick', () => {
    it('maps OHLC fields to ECharts [open, close, low, high] order', () => {
      const result = run([ohlcFrame()], 'candlestick');

      expect(result).not.toBeNull();
      expect(result!.series).toHaveLength(1);
      expect(result!.series[0]).toMatchObject({
        name: 'BTC',
        type: 'candlestick',
        data: [
          [10, 18, 5, 20],
          [15, 22, 12, 25],
        ],
      });
    });

    it('labels each item by its timestamp (ISO), one per row', () => {
      const result = run([ohlcFrame()], 'candlestick');

      expect(result!.categories).toEqual([new Date(0).toISOString(), new Date(60_000).toISOString()]);
    });

    it('resolves OHLC fields case-insensitively', () => {
      const result = run([ohlcFrame(['Open', 'HIGH', 'Low', 'Close'])], 'candlestick');

      expect(result!.series[0].data).toEqual([
        [10, 18, 5, 20],
        [15, 22, 12, 25],
      ]);
    });

    it('resolves a color for the series', () => {
      const result = run([ohlcFrame()], 'candlestick');

      expect(result!.series[0].itemStyle?.color).toEqual(expect.any(String));
    });

    it('preserves zero but maps null/undefined to gaps', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [0] },
          { name: 'open', type: FieldType.number, values: [0] },
          { name: 'high', type: FieldType.number, values: [null] },
          { name: 'low', type: FieldType.number, values: [undefined as unknown as number] },
          { name: 'close', type: FieldType.number, values: [3] },
        ],
      });

      const result = run([frame], 'candlestick');

      expect(result!.series[0].data).toEqual([[0, 3, null, null]]);
    });

    it('drops rows outside the dashboard time range when a time field is present', () => {
      const result = run([ohlcFrame()], 'candlestick', timeRange(0, 30_000));

      // Rows are at t=0 and t=60_000; only the first is within [0, 30_000].
      expect(result!.categories).toEqual([new Date(0).toISOString()]);
      expect(result!.series[0].data).toEqual([[10, 18, 5, 20]]);
    });

    it('keeps every row when the time range covers all rows', () => {
      const result = run([ohlcFrame()], 'candlestick', timeRange(0, 60_000));

      expect(result!.series[0].data).toHaveLength(2);
    });

    it('returns null when an OHLC field is missing', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: [0] },
          { name: 'open', type: FieldType.number, values: [10] },
          { name: 'high', type: FieldType.number, values: [20] },
          { name: 'low', type: FieldType.number, values: [5] },
        ],
      });

      expect(run([frame], 'candlestick')).toBeNull();
    });

    it('places the series on the configured zlevel', () => {
      const ctx = makeContext([ohlcFrame()], 'candlestick');
      const result = multiValueCartesianToEChartsOption({
        ...ctx,
        options: { ...ctx.options, zLevel: { series: 3 } },
      });
      const series = result!.series;
      if (!Array.isArray(series)) {
        throw new Error('Narrow series to array');
      }

      expect(series[0].zlevel).toBe(3);
    });
  });

  describe('boxplot', () => {
    const boxFrame = (fieldNames = ['min', 'q1', 'median', 'q3', 'max']): DataFrame =>
      toDataFrame({
        name: 'latency',
        fields: [
          { name: 'category', type: FieldType.string, values: ['a', 'b'] },
          { name: fieldNames[0], type: FieldType.number, values: [1, 2] },
          { name: fieldNames[1], type: FieldType.number, values: [3, 4] },
          { name: fieldNames[2], type: FieldType.number, values: [5, 6] },
          { name: fieldNames[3], type: FieldType.number, values: [7, 8] },
          { name: fieldNames[4], type: FieldType.number, values: [9, 10] },
        ],
      });

    it('maps named fields to [min, Q1, median, Q3, max] over a category axis', () => {
      const result = run([boxFrame()], 'boxplot');

      expect(result!.categories).toEqual(['a', 'b']);
      expect(result!.series[0]).toMatchObject({
        name: 'latency',
        type: 'boxplot',
        data: [
          [1, 3, 5, 7, 9],
          [2, 4, 6, 8, 10],
        ],
      });
    });

    it('falls back to the first five numeric fields when names do not match', () => {
      const result = run([boxFrame(['a', 'b', 'c', 'd', 'e'])], 'boxplot');

      expect(result!.series[0].data).toEqual([
        [1, 3, 5, 7, 9],
        [2, 4, 6, 8, 10],
      ]);
    });

    it('ignores the time range for a categorical (non-time) frame', () => {
      const result = run([boxFrame()], 'boxplot', timeRange(0, 1));

      expect(result!.categories).toEqual(['a', 'b']);
      expect(result!.series[0].data).toHaveLength(2);
    });

    it('returns null with fewer than five numeric fields', () => {
      const frame = toDataFrame({
        fields: [
          { name: 'category', type: FieldType.string, values: ['a'] },
          { name: 'min', type: FieldType.number, values: [1] },
          { name: 'q1', type: FieldType.number, values: [3] },
          { name: 'median', type: FieldType.number, values: [5] },
          { name: 'q3', type: FieldType.number, values: [7] },
        ],
      });

      expect(run([frame], 'boxplot')).toBeNull();
    });
  });

  it('returns null when no frame has a numeric field', () => {
    const frame = toDataFrame({
      fields: [{ name: 'category', type: FieldType.string, values: ['a', 'b'] }],
    });

    expect(run([frame], 'candlestick')).toBeNull();
  });
});

describe('resolveMultiValueSeriesType', () => {
  it('detects candlestick from OHLC field names', () => {
    expect(resolveMultiValueSeriesType([ohlcFrame()])).toBe('candlestick');
    expect(framesLookMultiValue([ohlcFrame()])).toBe(true);
  });

  it('detects candlestick case-insensitively', () => {
    expect(resolveMultiValueSeriesType([ohlcFrame(['Open', 'HIGH', 'Low', 'Close'])])).toBe('candlestick');
  });

  it('detects boxplot from a five-number summary (categorical, no time field)', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'category', type: FieldType.string, values: ['a', 'b'] },
        { name: 'min', type: FieldType.number, values: [1, 2] },
        { name: 'q1', type: FieldType.number, values: [3, 4] },
        { name: 'median', type: FieldType.number, values: [5, 6] },
        { name: 'q3', type: FieldType.number, values: [7, 8] },
        { name: 'max', type: FieldType.number, values: [9, 10] },
      ],
    });

    expect(resolveMultiValueSeriesType([frame])).toBe('boxplot');
    expect(framesLookMultiValue([frame])).toBe(true);
  });

  it('does not treat a plain multi-series numeric frame as multi-value (name-based, not count-based)', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, 1] },
        { name: 'cpu', type: FieldType.number, values: [1, 2] },
        { name: 'mem', type: FieldType.number, values: [3, 4] },
        { name: 'net', type: FieldType.number, values: [5, 6] },
        { name: 'disk', type: FieldType.number, values: [7, 8] },
        { name: 'io', type: FieldType.number, values: [9, 10] },
      ],
    });

    expect(resolveMultiValueSeriesType([frame])).toBeUndefined();
    expect(framesLookMultiValue([frame])).toBe(false);
  });

  it('returns undefined when no frame has a numeric field', () => {
    const frame = toDataFrame({ fields: [{ name: 'category', type: FieldType.string, values: ['a'] }] });

    expect(resolveMultiValueSeriesType([frame])).toBeUndefined();
  });
});

// The Grafana panel and the standalone renderer both show this issue through `PanelContent` (#779).
describe('getCandlestickDataIssue', () => {
  const withoutTime = toDataFrame({
    fields: [
      { name: 'open', type: FieldType.number, values: [1] },
      { name: 'high', type: FieldType.number, values: [2] },
      { name: 'low', type: FieldType.number, values: [0] },
      { name: 'close', type: FieldType.number, values: [1] },
    ],
  });

  it('gives no issue for OHLC fields with a time field', () => {
    expect(getCandlestickDataIssue(makeContext([ohlcFrame()], 'candlestick'))).toBeUndefined();
  });

  it.each([
    { name: 'no time field', frame: withoutTime, reason: 'candlestick-time-missing' },
    {
      name: 'no open, high, low and close fields',
      frame: ohlcFrame(['a', 'b', 'c', 'd']),
      reason: 'candlestick-fields-missing',
    },
  ])('gives an issue for $name, also from the cartesian module', ({ frame, reason }) => {
    const ctx = makeContext([frame], 'candlestick');
    expect(getCandlestickDataIssue(ctx)?.reason).toBe(reason);
    expect(cartesianChartModule.getDataIssue?.(ctx)?.reason).toBe(reason);
  });

  it('names the first missing field', () => {
    const issue = getCandlestickDataIssue(makeContext([ohlcFrame(['open', 'high', 'x', 'close'])], 'candlestick'));
    expect(issue?.message).toBe(CANDLESTICK_ISSUE_MESSAGES['candlestick-fields-missing']('low'));
  });

  it('names the row with high below low', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1, 2] },
        { name: 'open', type: FieldType.number, values: [1, 1] },
        { name: 'high', type: FieldType.number, values: [2, 0] },
        { name: 'low', type: FieldType.number, values: [0, 1] },
        { name: 'close', type: FieldType.number, values: [1, 1] },
      ],
    });
    expect(getCandlestickDataIssue(makeContext([frame], 'candlestick'))).toEqual({
      reason: 'high-below-low',
      message: CANDLESTICK_ISSUE_MESSAGES['high-below-low'](2),
    });
  });

  it('gives no issue for other series types', () => {
    expect(getCandlestickDataIssue(makeContext([withoutTime], 'boxplot'))).toBeUndefined();
  });
});

describe('unnamed fields', () => {
  // A malformed frame: its fields have no `name` (#867).
  const unnamedFrame = (): DataFrame =>
    ({
      length: 2,
      fields: [
        { type: FieldType.string, values: ['a', 'b'], config: {} },
        { type: FieldType.number, values: [1, 2], config: {} },
      ],
    }) as unknown as DataFrame;

  it('does not throw for boxplot', () => {
    expect(() => run([unnamedFrame()], 'boxplot')).not.toThrow();
    expect(() => framesLookMultiValue([unnamedFrame()])).not.toThrow();
  });
});

describe('getBoxplotDataIssue', () => {
  const box = (names: string[], rows: number[][]) =>
    toDataFrame({
      fields: [
        { name: 'service', type: FieldType.string, values: rows.map((_, i) => `s${i}`) },
        ...names.map((name, i) => ({ name, type: FieldType.number, values: rows.map((row) => row[i]) })),
      ],
    });

  it('names the first missing field', () => {
    const frame = box(['min', 'q1', 'q3', 'max'], [[1, 2, 4, 5]]);
    expect(getBoxplotDataIssue(makeContext([frame], 'boxplot'))).toEqual({
      reason: 'boxplot-fields-missing',
      message: BOXPLOT_ISSUE_MESSAGES['boxplot-fields-missing']('median'),
    });
  });

  it('names the row and the pair that are out of order', () => {
    const frame = box(
      ['min', 'q1', 'median', 'q3', 'max'],
      [
        [1, 2, 3, 4, 5],
        [3, 2, 3, 4, 5],
      ]
    );
    expect(getBoxplotDataIssue(makeContext([frame], 'boxplot'))?.message).toBe(
      BOXPLOT_ISSUE_MESSAGES['boxplot-out-of-order'](2, 'min', 'q1')
    );
  });

  it('gives no issue for ordered named fields', () => {
    expect(
      getBoxplotDataIssue(makeContext([box(['min', 'q1', 'median', 'q3', 'max'], [[1, 2, 3, 4, 5]])], 'boxplot'))
    ).toBeUndefined();
  });

  // The renderer draws the first five number fields when the named fields are missing, so these frames keep drawing.
  it('gives no issue when the positional fallback finds five number fields, in any order', () => {
    expect(
      getBoxplotDataIssue(makeContext([box(['a', 'b', 'c', 'd', 'e'], [[5, 4, 3, 2, 1]])], 'boxplot'))
    ).toBeUndefined();
  });

  it('names a missing field only when the positional fallback also fails', () => {
    const frame = box(['a', 'b', 'c', 'd'], [[1, 2, 3, 4]]);
    expect(getBoxplotDataIssue(makeContext([frame], 'boxplot'))?.message).toBe(
      BOXPLOT_ISSUE_MESSAGES['boxplot-fields-missing']('min')
    );
  });
});
