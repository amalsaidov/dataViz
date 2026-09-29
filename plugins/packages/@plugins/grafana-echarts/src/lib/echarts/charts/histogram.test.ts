import { createTheme, type DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { MAX_HISTOGRAM_BUCKETS } from 'lib/echarts/converters/histogram';
import { buildHistogramChartOption, getHistogramDataIssue } from './histogram';
import { type BaseOptionParts, type ChartContext } from './types';

const theme = createTheme();

const frameOf = (values: number[]): DataFrame =>
  toDataFrame({ fields: [{ name: 'Height', type: FieldType.number, values }] });

const contextOf = (values: number[], options: Record<string, unknown>): ChartContext =>
  ({
    frames: [frameOf(values)],
    options: { histogram: true, ...options },
    fieldConfig: { defaults: {}, overrides: [] },
    theme,
  }) as unknown as ChartContext;

const parts = { isGrafanaLegend: true, plotWidth: 400 } as BaseOptionParts;

describe('getHistogramDataIssue', () => {
  it('gives no issue for valid options', () => {
    expect(getHistogramDataIssue(contextOf([1, 2, 11], { bucketSize: 10 }))).toBeUndefined();
  });

  it.each<Record<string, unknown>>([
    { bucketSize: -1 },
    { bucketCount: -3 },
    { bucketSize: -1, bucketCount: -1 },
    { bucketOffset: Infinity },
  ])('gives no issue and draws the chart for %p, as core', (options) => {
    const ctx = contextOf([1, 2, 11], options);
    expect(getHistogramDataIssue(ctx)).toBeUndefined();
    expect(buildHistogramChartOption(ctx, parts)).not.toBeNull();
  });

  it('reports more buckets than the limit, and draws no bars', () => {
    // One bucket for each value: the limit plus one.
    const values = Array.from({ length: MAX_HISTOGRAM_BUCKETS + 1 }, (_, i) => i);
    const ctx = contextOf(values, { bucketSize: 1 });
    expect(getHistogramDataIssue(ctx)).toEqual({
      reason: 'histogram-too-many-buckets',
      message: `The histogram has ${MAX_HISTOGRAM_BUCKETS + 1} buckets. The limit is ${MAX_HISTOGRAM_BUCKETS}. Use a larger bucket size or a smaller bucket count.`,
    });
    expect(buildHistogramChartOption(ctx, parts)).toBeNull();
  });

  it('gives no issue at the limit', () => {
    const values = Array.from({ length: MAX_HISTOGRAM_BUCKETS }, (_, i) => i);
    const ctx = contextOf(values, { bucketSize: 1 });
    expect(getHistogramDataIssue(ctx)).toBeUndefined();
    expect(buildHistogramChartOption(ctx, parts)).not.toBeNull();
  });
});
