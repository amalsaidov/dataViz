import { createTheme, dateTime, type DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { LegendDisplayMode, StackingMode, TooltipDisplayMode } from '@grafana/schema';
import { type CustomSeriesOption } from 'echarts';
import { type TopLevelFormatterParams } from 'echarts/types/dist/shared';
import { cartesianChartModule } from 'lib/echarts/charts/cartesian';
import { type ChartContext } from 'lib/echarts/charts/types';
import { buildHistogramModel } from 'lib/echarts/converters/histogram';
import { type TooltipModel } from 'lib/echarts/tooltip/types';
import { type PanelOptions } from 'types';
import { buildHistogramOption } from './histogram';
import { buildPanelChartOption } from './panelOption';

const theme = createTheme();
const legend = { showLegend: true, displayMode: LegendDisplayMode.List, placement: 'bottom' as const, calcs: [] };
const noOverrides = { defaults: {}, overrides: [] };

const frame = (fields: Record<string, number[]>, unit?: string): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: Object.values(fields)[0].map((_, i) => 1783137094497 + i) },
      ...Object.entries(fields).map(([name, values]) => ({ name, type: FieldType.number, values, config: { unit } })),
    ],
  });

/** The series of the histogram option. The tooltip models go to `sink`. */
const optionFor = (frames: DataFrame[], options: Partial<PanelOptions> = {}, sink?: (model: TooltipModel) => void) => {
  const option = buildHistogramOption({
    model: buildHistogramModel(frames, { bucketSize: 10 }, theme)!,
    theme,
    options: { legend, ...options } as PanelOptions,
    fieldConfig: noOverrides,
    isGrafanaLegend: true,
    tooltipSink: sink,
  });
  return option.series as CustomSeriesOption[];
};

/** The `[xMin, xMax, base, top, count]` rows of each series. */
const rowsOf = (series: CustomSeriesOption[]) => series.map((entry) => entry.data);

/** The tooltip model of series `seriesIndex` at bucket `dataIndex`. */
const tooltipOf = (frames: DataFrame[], options: Partial<PanelOptions>, seriesIndex: number, dataIndex: number) => {
  const models: TooltipModel[] = [];
  const series = optionFor(frames, options, (model) => models.push(model));
  const { formatter } = series[seriesIndex].tooltip as { formatter: (params: TopLevelFormatterParams) => string };
  formatter({ dataIndex, seriesIndex } as TopLevelFormatterParams);
  return models[0];
};

describe('buildHistogramOption', () => {
  const twoSeries = [frame({ A: [1, 2, 11], B: [3, 12, 13] })];

  it('draws each series from zero with Stacking Off', () => {
    expect(rowsOf(optionFor(twoSeries))).toEqual([
      [
        [0, 10, 0, 2, 2],
        [10, 20, 0, 1, 1],
      ],
      [
        [0, 10, 0, 1, 1],
        [10, 20, 0, 2, 2],
      ],
    ]);
  });

  it('starts each series on the top of the series before it with Stacking Normal', () => {
    expect(rowsOf(optionFor(twoSeries, { stacking: StackingMode.Normal }))[1]).toEqual([
      [0, 10, 2, 3, 1],
      [10, 20, 1, 3, 2],
    ]);
  });

  it('divides by the total of the bucket with Stacking 100%', () => {
    const series = optionFor(twoSeries, { stacking: StackingMode.Percent });
    const tops = (rowsOf(series)[1] as number[][]).map((row) => row[3]);
    expect(tops).toEqual([1, 1]);
  });

  it('spans the x axis from the first lower bound to the last upper bound', () => {
    const model = buildHistogramModel(twoSeries, { bucketSize: 10 }, theme)!;
    const option = buildHistogramOption({
      model,
      theme,
      options: { legend } as unknown as PanelOptions,
      fieldConfig: noOverrides,
      isGrafanaLegend: true,
      plotWidth: 400,
    });
    expect(option.xAxis).toMatchObject({ type: 'value', min: 0, max: 20, interval: 10 });
  });

  it('gives no more than 50 x ticks when the plot width is not known', () => {
    // Two buckets of size 1, 1000 buckets apart: one tick for each bucket would give 1001 ticks.
    const model = buildHistogramModel([frame({ A: [0.5, 1000.5] })], { bucketSize: 1 }, theme)!;
    const option = buildHistogramOption({
      model,
      theme,
      options: { legend } as unknown as PanelOptions,
      fieldConfig: noOverrides,
      isGrafanaLegend: true,
      plotWidth: undefined,
    });
    expect(option.xAxis).toMatchObject({ min: 0, max: 1001, interval: 21 });
  });
});

describe('histogram tooltip', () => {
  const frames = [frame({ A: [1, 2, 11], B: [3, 12, 13] })];

  it('gives the bucket range in the header and the hovered count in Single mode', () => {
    const model = tooltipOf(frames, {}, 1, 1);
    expect(model.header).toEqual({ label: 'Bucket', value: '10 - 20' });
    expect(model.rows.map(({ label, value }) => [label, value])).toEqual([['B', '2']]);
    expect(model.source?.rowIndex).toBe(1);
  });

  it('lists the count of each series in the bucket in "All" mode', () => {
    const model = tooltipOf(frames, { tooltip: { mode: TooltipDisplayMode.Multi } as never }, 1, 0);
    expect(model.rows.map(({ label, value, emphasis }) => [label, value, emphasis])).toEqual([
      ['A', '2', false],
      ['B', '1', true],
    ]);
  });

  it('formats the bucket range with the unit of the bucketed field', () => {
    const model = tooltipOf([frame({ A: [100, 250] }, 'ms')], {}, 0, 0);
    expect(model.header.value).toBe('100 ms - 110 ms');
  });
});

describe('histogram mode in the panel option', () => {
  const ctx = (options: Partial<PanelOptions>): ChartContext => ({
    frames: [frame({ A: [1, 2, 11] })],
    theme,
    timeZone: 'utc',
    timeRange: { from: dateTime(1783137094497), to: dateTime(1783147894497), raw: { from: 'now-3h', to: 'now' } },
    options: { legend, histogram: true, bucketSize: 10, ...options } as PanelOptions,
    seriesType: 'line',
    formatValue: (value) => ({ text: String(value) }),
    replaceVariables: (value: string) => value,
    fieldConfig: noOverrides,
  });

  it('draws custom bar series on a value x axis, also for frames with a time field', () => {
    const option = buildPanelChartOption(ctx({}), { isGrafanaLegend: true })!;
    expect(option.xAxis).toMatchObject({ type: 'value' });
    expect((option.series as CustomSeriesOption[]).map((entry) => entry.type)).toEqual(['custom']);
    // No drag-to-zoom brush: the x axis is not a time axis.
    expect(option.brush).toBeUndefined();
  });

  it('uses the tooltip of each bar in "All" mode, which lists every count of the bucket', () => {
    const option = buildPanelChartOption(ctx({ tooltip: { mode: TooltipDisplayMode.Multi } as never }), {
      isGrafanaLegend: true,
    })!;
    expect(option.tooltip).toMatchObject({ trigger: 'item' });
  });

  it('lists one legend item for each series', () => {
    const items = cartesianChartModule.buildLegendItems(ctx({}), []);
    expect(items.map((item) => item.label)).toEqual(['A']);
  });

  it('draws the normal chart when the histogram switch is off', () => {
    const option = buildPanelChartOption(ctx({ histogram: false }), { isGrafanaLegend: true })!;
    expect(option.xAxis).toMatchObject({ type: 'time' });
  });
});
