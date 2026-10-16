import { createTheme, type DataFrame, FieldType, getDefaultTimeRange, toDataFrame } from '@grafana/data';
import { StackingMode, VizOrientation } from '@grafana/schema';
import { type CartesianSingleValueSeriesType } from 'editor/types';
import { cartesianChartModule } from 'lib/echarts/charts/cartesian';
import { type ChartContext } from 'lib/echarts/charts/types';
import { getTimeBandCount } from 'lib/echarts/converters/timeSeries';
import { applyGrafanaFieldDefaults } from 'test/panel';
import { type PanelOptions } from 'types';

// Option-level claims of the core Bar chart parity rules in the cartesian chart
// module: orientation, the category axis, stacking on a time axis.

const theme = createTheme();

const context = (
  frames: DataFrame[],
  options: Partial<PanelOptions> = {},
  seriesType: CartesianSingleValueSeriesType = 'bar'
): ChartContext<CartesianSingleValueSeriesType> => ({
  frames: applyGrafanaFieldDefaults(frames),
  theme,
  timeZone: 'utc',
  timeRange: getDefaultTimeRange(),
  options: { seriesType, ...options } as PanelOptions,
  seriesType,
  formatValue: (value) => ({ text: `${value}` }),
  fieldConfig: { defaults: {}, overrides: [] },
  replaceVariables: (value) => value,
});

const build = (ctx: ChartContext<CartesianSingleValueSeriesType>, plotWidth = 400, plotHeight = 300) => {
  const option = cartesianChartModule.buildOption(ctx, { isGrafanaLegend: true, plotWidth, plotHeight });
  if (!option) {
    throw new Error('no option');
  }
  return option;
};

const categoryFrame = () =>
  toDataFrame({
    fields: [
      { name: 'category', type: FieldType.string, values: ['a long label', 'b', 'c'] },
      { name: 'A', type: FieldType.number, values: [1, 2, 3] },
    ],
  });

describe('cartesian bars: orientation', () => {
  it('puts the categories on y in a tall panel, as core Auto orientation', () => {
    const option = build(context([categoryFrame()], { orientation: VizOrientation.Auto }), 300, 600);
    expect(option.yAxis).toMatchObject({ type: 'category', inverse: true });
    expect(option.xAxis).toEqual([expect.objectContaining({ type: 'value', position: 'bottom' })]);
    expect(option.series).toEqual([expect.objectContaining({ xAxisIndex: 0, yAxisIndex: 0 })]);
  });

  it('keeps a category line chart upright', () => {
    const option = build(context([categoryFrame()], { orientation: VizOrientation.Horizontal }, 'line'), 300, 600);
    expect(option.xAxis).toMatchObject({ type: 'category' });
  });
});

describe('cartesian bars: category axis', () => {
  it('draws no grid lines or ticks on the category axis, as core', () => {
    expect(build(context([categoryFrame()])).xAxis).toMatchObject({
      splitLine: { show: false },
      axisTick: { show: false },
    });
  });

  it('cuts rotated tick labels at the max length and skips labels closer than the minimum spacing', () => {
    const { xAxis } = build(
      context([categoryFrame()], { xTickRotate: -45, xTickLabelMaxLength: 4, xTickLabelSpacing: 200 })
    );
    const axisLabel = (xAxis as { axisLabel: { formatter: (label: string) => string; interval: number } }).axisLabel;
    expect(axisLabel.formatter('a long label')).toBe('a lo...');
    expect(axisLabel.formatter('b')).toBe('b');
    // 400 px over 3 categories: a 200 px spacing shows every second label.
    expect(axisLabel.interval).toBe(1);
  });

  it('keeps full tick labels without rotation, as core', () => {
    const { xAxis } = build(context([categoryFrame()], { xTickLabelMaxLength: 4 }));
    expect((xAxis as { axisLabel: object }).axisLabel).not.toHaveProperty('formatter');
  });

  it('draws a band over the hovered category with "Highlight full area on hover"', () => {
    expect(build(context([categoryFrame()], { fullHighlight: true })).xAxis).toMatchObject({
      axisPointer: { show: true, type: 'shadow' },
    });
    expect(
      build(context([categoryFrame()], { fullHighlight: true, stacking: StackingMode.Normal })).xAxis
    ).not.toHaveProperty('axisPointer');
  });
});

describe('cartesian bars: time axis', () => {
  const timeFrame = (name: string, times: number[], values: number[]) =>
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: times },
        { name, type: FieldType.number, values },
      ],
    });

  it('joins stacked frames on time, so each stack sums the values at one timestamp', () => {
    const frames = [timeFrame('A', [1000, 2000], [10, 20]), timeFrame('B', [2000, 3000], [5, 6])];
    const { series } = build(context(frames, { stacking: StackingMode.Normal }));
    expect((series as Array<{ data: unknown }>).map(({ data }) => data)).toEqual([
      [
        [1000, 10],
        [2000, 20],
        [3000, null],
      ],
      [
        [1000, null],
        [2000, 5],
        [3000, 6],
      ],
    ]);
  });

  it('leaves unstacked frames apart', () => {
    const frames = [timeFrame('A', [1000], [10]), timeFrame('B', [2000], [5])];
    const { series } = build(context(frames));
    expect((series as Array<{ data: unknown }>).map(({ data }) => data)).toEqual([[[1000, 10]], [[2000, 5]]]);
  });

  it('counts the time bands from the smallest gap between two points', () => {
    expect(getTimeBandCount([[0, 10, 30]], 100)).toBe(10);
    expect(getTimeBandCount([[5]], 100)).toBe(0);
  });
});

describe('cartesian bars: value axis range (#999)', () => {
  const timeFrame = () =>
    toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: [1000, 2000, 3000] },
        { name: 'A', type: FieldType.number, values: [5, 7, 9] },
      ],
    });

  it('includes zero on a bar axis by default, as core Bar chart', () => {
    const option = build(context([timeFrame()]));
    expect(option.yAxis).toEqual([expect.objectContaining({ scale: false })]);
  });

  it('fits a bar axis to the data with barsIncludeZero false, as core Time series', () => {
    const option = build(context([timeFrame()], { barsIncludeZero: false }));
    expect(option.yAxis).toEqual([expect.objectContaining({ scale: true })]);
  });
});
