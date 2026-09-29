import { createTheme, type DataFrame, type Field, FieldType, getDefaultTimeRange, toDataFrame } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import { type LineSeriesOption } from 'echarts';
import { seriesTypePath } from 'editor/constants';
import { type CartesianSingleValueSeriesType } from 'editor/types';
import { cartesianChartModule } from 'lib/echarts/charts/cartesian';
import { type ChartContext } from 'lib/echarts/charts/types';
import { resolveDrawnValues } from 'lib/echarts/converters/cartesianValues';
import { connectStackedLines, stackedLineSeries } from 'lib/echarts/converters/stackedLines';
import { type PanelOptions } from 'types';

// The null rules of a stack of line series, against core Time series `preparePlotData2`:
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/utils.ts

const HOUR = 3_600_000;
const xs = [0, 1, 2, 3, 4, 5, 6].map((i) => i * HOUR);

const field = (values: Array<number | null | undefined>, spanNulls?: boolean | number, custom = {}): Field =>
  ({
    name: 'v',
    type: FieldType.number,
    values,
    config: { custom: { ...custom, ...(spanNulls == null ? {} : { spanNulls }) } },
  }) as Field;

describe('stackedLineSeries', () => {
  it('adds 0 for a null where another field of the stack has a value, as core', () => {
    const [a, b] = stackedLineSeries(xs.slice(0, 3), [field([1, 2, 3]), field([4, null, 6])]);
    expect(b.drawnValues).toEqual([4, 0, 6]);
    expect(a.drawnValues).toEqual([1, 2, 3]);
    // The tooltip shows the field value.
    expect(b.values).toEqual([4, null, 6]);
    expect(b.rows).toEqual([0, 1, 2]);
  });

  it('adds 0 for leading and trailing nulls of one field, when the others have values', () => {
    const [, b] = stackedLineSeries(xs.slice(0, 4), [field([1, 2, 3, 4]), field([null, 5, 6, null])]);
    expect(b.drawnValues).toEqual([0, 5, 6, 0]);
  });

  it('keeps a row where each field is null when `false`, so each line breaks', () => {
    const series = stackedLineSeries(xs.slice(0, 3), [field([1, null, 3], false), field([4, null, 6], false)]);
    expect(series.map(({ rows }) => rows)).toEqual([
      [0, 1, 2],
      [0, 1, 2],
    ]);
    expect(series.map(({ drawnValues }) => drawnValues)).toEqual([
      [1, null, 3],
      [4, null, 6],
    ]);
  });

  it('leaves out a row where each field is null when `true`', () => {
    const series = stackedLineSeries(xs.slice(0, 3), [field([1, null, 3], true), field([4, null, 6], true)]);
    expect(series.map(({ rows }) => rows)).toEqual([
      [0, 2],
      [0, 2],
    ]);
  });

  it('leaves out a short run under a numeric threshold, and keeps a long run', () => {
    // Run 1 (row 1) is 2 h wide; run 2 (rows 3 to 5) is 4 h wide.
    const a = [1, null, 2, null, null, null, 3];
    const b = [5, null, 6, null, null, null, 7];
    const [first, second] = stackedLineSeries(xs, [field(a, 3 * HOUR), field(b, 3 * HOUR)]);
    expect(first.rows).toEqual([0, 2, 3, 4, 5, 6]);
    expect(second.rows).toEqual(first.rows);
    expect(first.drawnValues).toEqual([1, 2, null, null, null, 3]);
  });

  it('measures the threshold on unequal row distances', () => {
    // Rows at 0 h, 1 h, 5 h: the run at 1 h is 5 h wide.
    const times = [0, 1, 5].map((i) => i * HOUR);
    const fields = (threshold: number) => [field([1, null, 3], threshold), field([2, null, 4], threshold)];
    expect(stackedLineSeries(times, fields(6 * HOUR))[0].rows).toEqual([0, 2]);
    expect(stackedLineSeries(times, fields(5 * HOUR))[0].rows).toEqual([0, 1, 2]);
  });

  it('keeps leading and trailing rows where each field is null under a threshold', () => {
    const series = stackedLineSeries(xs.slice(0, 4), [
      field([null, 1, 2, null], 10 * HOUR),
      field([null, 3, 4, null], 10 * HOUR),
    ]);
    expect(series[0].rows).toEqual([0, 1, 2, 3]);
  });

  it('keeps a row where one field breaks, though another field connects over it', () => {
    const series = stackedLineSeries(xs.slice(0, 3), [field([1, null, 3], false), field([4, null, 6], true)]);
    expect(series[1].rows).toEqual([0, 1, 2]);
    expect(series[1].drawnValues).toEqual([4, null, 6]);
    // The field that connects gets a connected point there; the field that breaks does not.
    expect(series[1].connected).toEqual([1]);
    expect(series[0].connected).toBeUndefined();
  });

  it('connects a field with a threshold over a row where another field breaks (#440)', () => {
    // Row 1 is 2 h wide: `b` connects under its 3 h threshold, `a` never connects.
    const [a, b] = stackedLineSeries(xs.slice(0, 3), [field([1, null, 3], false), field([4, null, 6], 3 * HOUR)]);
    expect(b.rows).toEqual([0, 1, 2]);
    expect(b.connected).toEqual([1]);
    expect(a.connected).toBeUndefined();
  });

  it('gives no connected point where the threshold breaks the line', () => {
    const [, b] = stackedLineSeries(xs.slice(0, 3), [field([1, null, 3], false), field([4, null, 6], HOUR)]);
    expect(b.connected).toBeUndefined();
  });

  it('does not add 0 for a row where only a field hidden from the viz has a value, as core', () => {
    // Core `anyValsAtX` leaves out a field with `hideFrom.viz`.
    const hidden = field([1, 2, 3], undefined, { hideFrom: { viz: true, legend: false, tooltip: false } });
    const [, b] = stackedLineSeries(xs.slice(0, 3), [hidden, field([4, null, 6], false)]);
    expect(b.drawnValues).toEqual([4, null, 6]);
  });

  it('always connects over a row that the time join adds (`undefined`), as uPlot', () => {
    // Row 1 is a timestamp of another frame: both fields are `undefined` there.
    const series = stackedLineSeries(xs.slice(0, 3), [field([1, undefined, 3], false), field([4, undefined, 6])]);
    expect(series[0].rows).toEqual([0, 2]);
  });

  it('does not change the field values', () => {
    const values = [1, null, 3];
    const other = [null, null, 5];
    stackedLineSeries(xs.slice(0, 3), [field(values, true), field(other, true)]);
    expect(values).toEqual([1, null, 3]);
    expect(other).toEqual([null, null, 5]);
  });
});

describe('connectStackedLines', () => {
  it('puts a connected point on the segment of its line, less the stack below it', () => {
    // `a` breaks at row 1. The line of `b` goes from 1 + 4 = 5 to 3 + 6 = 9.
    const [a, b] = connectStackedLines(
      xs,
      [
        [1, null, 3],
        [4, null, 6],
      ],
      [[], [1]]
    );
    expect(a).toEqual([1, null, 3]);
    expect(b).toEqual([4, 7, 6]);
  });

  it('subtracts the connected points of the lines below', () => {
    // `a` goes from 1 to 3, so it draws 2. `b` goes from 5 to 9, so it draws 7 - 2 = 5.
    const [a, b] = connectStackedLines(
      xs,
      [
        [1, null, 3],
        [4, null, 6],
      ],
      [[1], [1]]
    );
    expect(a[1]).toBe(2);
    expect(b[1]).toBe(5);
  });

  it('places the point by its x on unequal row distances', () => {
    // Rows at 0 h, 1 h and 4 h: row 1 is a quarter of the way from 4 to 8.
    const [b] = connectStackedLines(
      [0, 1, 4].map((i) => i * HOUR),
      [[4, null, 8]],
      [[1]]
    );
    expect(b[1]).toBe(5);
  });

  it('places the point on the 100% line of the shares', () => {
    // Row 0: `a` 25%, `b` 75%. Row 2: `a` 75%, `b` 25%. The top of the stack is 1 at both rows.
    const [a, b] = [field([1, null, 3], false), field([3, null, 1], 3 * HOUR)];
    const [drawnA, drawnB] = stackedLineSeries(xs.slice(0, 3), [a, b]);
    const sources = [
      { field: a, ...drawnA },
      { field: b, ...drawnB },
    ].map((source) => ({ ...source, xs: xs.slice(0, 3), stacked: true, isBar: false }));
    const [percentA, percentB] = resolveDrawnValues(sources as never, StackingMode.Percent);
    expect(percentA).toEqual([0.25, null, 0.75]);
    expect(percentB[1]).toBe(1);
  });
});

describe('stacked line series of the Cartesian panel', () => {
  const theme = createTheme();

  const context = (
    frames: DataFrame[],
    options: Partial<PanelOptions> = {},
    seriesType: CartesianSingleValueSeriesType = 'line'
  ): ChartContext<CartesianSingleValueSeriesType> => ({
    frames,
    theme,
    timeZone: 'utc',
    timeRange: getDefaultTimeRange(),
    options: { [seriesTypePath]: seriesType, stacking: StackingMode.Normal, ...options } as PanelOptions,
    seriesType,
    formatValue: (value) => ({ text: String(value) }),
    replaceVariables: (value: string) => value,
    fieldConfig: { defaults: {}, overrides: [] },
  });

  const timeFrame = (name: string, hours: number[], values: Array<number | null>, spanNulls?: boolean | number) =>
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: hours.map((hour) => hour * HOUR) },
        {
          name,
          type: FieldType.number,
          values,
          config: { displayName: name, ...(spanNulls == null ? {} : { custom: { spanNulls } }) },
        },
      ],
    });

  const lineSeries = (frames: DataFrame[], options: Partial<PanelOptions> = {}) => {
    const option = cartesianChartModule.buildOption(context(frames, options), { isGrafanaLegend: true });
    return (option?.series as LineSeriesOption[]).filter((series) => series.type === 'line');
  };

  it('stacks the lines of two frames with unequal timestamps on one data index', () => {
    const frames = [timeFrame('A', [0, 1, 2], [1, 2, 3]), timeFrame('B', [1, 2, 3], [10, 20, 30])];
    const [a, b] = lineSeries(frames);
    expect(a.stack).toBe('total-line');
    expect(b.stack).toBe('total-line');
    // Joined rows 0 h to 3 h. At 0 h, B has no row but A has a value: B adds 0.
    // At 3 h, A has no row but B has a value: A adds 0.
    // The data item carries the field value last, for the tooltip.
    expect(a.data).toEqual([
      [0, 1],
      [HOUR, 2],
      [2 * HOUR, 3],
      [3 * HOUR, 0, null],
    ]);
    expect(b.data).toEqual([
      [0, 0, null],
      [HOUR, 10],
      [2 * HOUR, 20],
      [3 * HOUR, 30],
    ]);
  });

  it('sets `connectNulls` on a stacked line with `spanNulls: true`', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, HOUR, 2 * HOUR] },
        { name: 'A', type: FieldType.number, values: [1, null, 3], config: { custom: { spanNulls: true } } },
        { name: 'B', type: FieldType.number, values: [4, null, 6], config: { custom: { spanNulls: false } } },
      ],
    });
    const [a, b] = lineSeries([frame]);
    expect(a.connectNulls).toBe(true);
    expect(b.connectNulls).toBeUndefined();
  });

  it('draws 100% stacks of lines as the share of the line total', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, HOUR] },
        { name: 'A', type: FieldType.number, values: [1, 3] },
        { name: 'B', type: FieldType.number, values: [3, null] },
      ],
    });
    const [a, b] = lineSeries([frame], { stacking: StackingMode.Percent });
    // The data item carries the field value last, for the tooltip.
    expect(a.data).toEqual([
      [0, 0.25, 1],
      [HOUR, 1, 3],
    ]);
    expect(b.data).toEqual([
      [0, 0.75, 3],
      [HOUR, 0, null],
    ]);
  });

  it('draws a connected point with no symbol and keeps the field value for the tooltip (#440)', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, HOUR, 2 * HOUR] },
        { name: 'A', type: FieldType.number, values: [1, null, 3], config: { custom: { spanNulls: false } } },
        { name: 'B', type: FieldType.number, values: [4, null, 6], config: { custom: { spanNulls: 3 * HOUR } } },
      ],
    });
    const [a, b] = lineSeries([frame]);
    expect(a.data?.[1]).toEqual([HOUR, null]);
    expect(b.data?.[1]).toEqual({ value: [HOUR, 7, null], symbol: 'none' });
  });

  it('maps each tooltip point of a stack with a left-out row back to its frame row', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [0, HOUR, 2 * HOUR] },
        { name: 'A', type: FieldType.number, values: [1, null, 3], config: { custom: { spanNulls: true } } },
        { name: 'B', type: FieldType.number, values: [4, null, 6], config: { custom: { spanNulls: true } } },
      ],
    });
    const resolve = cartesianChartModule.getTooltipFieldResolver!(context([frame]));
    // The stack leaves out row 1, so data index 1 is frame row 2.
    expect(resolve({ seriesIndex: 1, dataIndex: 1 })?.rowIndex).toBe(2);
  });
});
