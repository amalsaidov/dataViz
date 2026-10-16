import { createTheme, type DataFrame, FieldType, getDefaultTimeRange, toDataFrame } from '@grafana/data';
import { type LineSeriesOption } from 'echarts';
import { seriesTypePath } from 'editor/constants';
import { type CartesianSingleValueSeriesType } from 'editor/types';
import { cartesianChartModule } from 'lib/echarts/charts/cartesian';
import { type ChartContext } from 'lib/echarts/charts/types';
import { categoryCartesianToEChartsOption } from 'lib/echarts/converters/categoryCartesian';
import { spannedRows } from 'lib/echarts/converters/spanNulls';
import { timeSeriesToEChartsOption } from 'lib/echarts/converters/timeSeries';
import { type PanelOptions } from 'types';

const theme = createTheme();
const HOUR = 3_600_000;

const context = (
  frames: DataFrame[],
  seriesType: CartesianSingleValueSeriesType = 'line'
): ChartContext<CartesianSingleValueSeriesType> => ({
  frames,
  theme,
  timeZone: 'utc',
  timeRange: getDefaultTimeRange(),
  options: { [seriesTypePath]: seriesType } as PanelOptions,
  seriesType,
  formatValue: (value) => ({ text: String(value) }),
  replaceVariables: (value: string) => value,
  fieldConfig: { defaults: {}, overrides: [] },
});

/** A time frame with one value field, one hour between the rows. */
const timeFrame = (values: Array<number | null>, spanNulls?: boolean | number, times?: number[]): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: times ?? values.map((_, i) => i * HOUR) },
      { name: 'cpu', type: FieldType.number, values, config: spanNulls == null ? {} : { custom: { spanNulls } } },
    ],
  });

const lineSeries = (frames: DataFrame[], seriesType: CartesianSingleValueSeriesType = 'line') =>
  (timeSeriesToEChartsOption(context(frames, seriesType)) ?? []) as LineSeriesOption[];

describe('spannedRows', () => {
  const xs = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => i * HOUR);

  it('leaves out the nulls of an internal run shorter than the threshold', () => {
    // The values around the run are 2 hours apart.
    expect(spannedRows(xs, [1, null, 3], 2 * HOUR + 1)).toEqual([0, 2]);
  });

  it('keeps the nulls of a run as long as the threshold, as core (`<`, not `<=`)', () => {
    expect(spannedRows(xs, [1, null, 3], 2 * HOUR)).toEqual([0, 1, 2]);
  });

  it('keeps leading and trailing nulls, which have a value on one side only', () => {
    expect(spannedRows(xs, [null, null, 1, null, 2, null, null], 10 * HOUR)).toEqual([0, 1, 2, 4, 5, 6]);
  });

  it('decides each internal run on its own gap', () => {
    // Run 1 (row 1) is 2 h wide; run 2 (rows 3 to 5) is 4 h wide.
    expect(spannedRows(xs, [1, null, 2, null, null, null, 3], 3 * HOUR)).toEqual([0, 2, 3, 4, 5, 6]);
  });

  it('measures the gap on the x values, not on the row count', () => {
    const uneven = [0, HOUR, 10 * HOUR];
    expect(spannedRows(uneven, [1, null, 2], 5 * HOUR)).toEqual([0, 1, 2]);
    expect(spannedRows(uneven, [1, null, 2], 11 * HOUR)).toEqual([0, 2]);
  });

  it('keeps each row when there is no null', () => {
    expect(spannedRows(xs, [1, 2, 3], HOUR)).toEqual([0, 1, 2]);
  });
});

describe('spanNulls on the time axis', () => {
  it('sets no connectNulls by default, so an untouched panel is unchanged', () => {
    const [series] = lineSeries([timeFrame([1, null, 3])]);
    expect(series).not.toHaveProperty('connectNulls');
    expect(series.data).toEqual([
      [0, 1],
      [HOUR, null],
      [2 * HOUR, 3],
    ]);
  });

  it('maps `false` to no connectNulls and keeps the null', () => {
    const [series] = lineSeries([timeFrame([1, null, 3], false)]);
    expect(series).not.toHaveProperty('connectNulls');
    expect(series.data).toHaveLength(3);
  });

  it('maps `true` to connectNulls and keeps the null point', () => {
    const [series] = lineSeries([timeFrame([null, 1, null, 3, null], true)]);
    expect(series.connectNulls).toBe(true);
    expect(series.data).toHaveLength(5);
  });

  it('sets connectNulls on an area series (a line with a fill)', () => {
    const frames = [timeFrame([1, null, 3], true)];
    const [series] = (timeSeriesToEChartsOption({
      ...context(frames),
      options: { ...context(frames).options, fillOpacity: 20 },
    }) ?? []) as LineSeriesOption[];
    expect(series.areaStyle).toBeDefined();
    expect(series.connectNulls).toBe(true);
  });

  it('does not set connectNulls on bar and scatter series', () => {
    expect(lineSeries([timeFrame([1, null, 3], true)], 'bar')[0]).not.toHaveProperty('connectNulls');
    expect(lineSeries([timeFrame([1, null, 3], true)], 'scatter')[0]).not.toHaveProperty('connectNulls');
  });

  it('draws a threshold as the rows it keeps, and never as connectNulls', () => {
    const [short] = lineSeries([timeFrame([1, null, 3], 3 * HOUR)]);
    expect(short).not.toHaveProperty('connectNulls');
    expect(short.data).toEqual([
      [0, 1],
      [2 * HOUR, 3],
    ]);

    const [long] = lineSeries([timeFrame([1, null, 3], HOUR)]);
    expect(long).not.toHaveProperty('connectNulls');
    expect(long.data).toHaveLength(3);
  });

  it('does not change the frame values', () => {
    const frame = timeFrame([1, null, null, 4], 10 * HOUR);
    lineSeries([frame]);
    expect(frame.fields[1].values).toEqual([1, null, null, 4]);
    expect(frame.fields[0].values).toEqual([0, HOUR, 2 * HOUR, 3 * HOUR]);
  });

  it('keeps each series on its own timestamps, so unequal timestamps add no nulls', () => {
    const a = timeFrame([1, 2, 3], false, [0, 2 * HOUR, 4 * HOUR]);
    const b = timeFrame([4, null, 6], 10 * HOUR, [HOUR, 3 * HOUR, 5 * HOUR]);
    const [first, second] = lineSeries([a, b]);
    expect(first.data).toEqual([
      [0, 1],
      [2 * HOUR, 2],
      [4 * HOUR, 3],
    ]);
    expect(second.data).toEqual([
      [HOUR, 4],
      [5 * HOUR, 6],
    ]);
  });

  it('maps a tooltip dataIndex back to its frame row when the threshold leaves rows out', () => {
    const frames = [timeFrame([1, null, null, 4, 5], 10 * HOUR)];
    const resolve = cartesianChartModule.getTooltipFieldResolver!(context(frames));
    // Series data: rows 0, 3 and 4.
    expect(resolve({ seriesIndex: 0, dataIndex: 1 })?.rowIndex).toBe(3);
    expect(resolve({ seriesIndex: 0, dataIndex: 2 })?.rowIndex).toBe(4);
  });

  it('keeps the tooltip dataIndex as the row for a series that draws each row', () => {
    const resolve = cartesianChartModule.getTooltipFieldResolver!(context([timeFrame([1, null, 3], true)]));
    expect(resolve({ seriesIndex: 0, dataIndex: 1 })?.rowIndex).toBe(1);
  });

  it('reports no notice on a time axis', () => {
    expect(cartesianChartModule.getNotices!(context([timeFrame([1, null, 3], HOUR)]))).toEqual([]);
  });
});

describe('spanNulls on a category axis', () => {
  const categoryFrame = (spanNulls: boolean | number): DataFrame =>
    toDataFrame({
      fields: [
        { name: 'host', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'cpu', type: FieldType.number, values: [1, null, 3], config: { custom: { spanNulls } } },
      ],
    });

  const categorySeries = (frame: DataFrame) =>
    categoryCartesianToEChartsOption(context([frame])).series as LineSeriesOption[];

  it('maps `true` to connectNulls', () => {
    expect(categorySeries(categoryFrame(true))[0].connectNulls).toBe(true);
  });

  it('draws a threshold as `false` and reports a notice, never as connectNulls', () => {
    expect(categorySeries(categoryFrame(HOUR))[0]).not.toHaveProperty('connectNulls');
    expect(cartesianChartModule.getNotices!(context([categoryFrame(HOUR)]))).toEqual([
      {
        severity: 'warning',
        text: 'Connect null values: a threshold needs a time axis. 1 series break at each null value.',
      },
    ]);
  });

  it('reports no notice for a boolean', () => {
    expect(cartesianChartModule.getNotices!(context([categoryFrame(true)]))).toEqual([]);
  });
});
