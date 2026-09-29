import { type DataFrame } from '@grafana/data';
import { type VizLegendItem } from '@grafana/ui';
import {
  buildHistogramModel,
  getHistogramOptions,
  type HistogramModel,
  isOrdinalHistogram,
  MAX_HISTOGRAM_BUCKETS,
} from 'lib/echarts/converters/histogram';
import { buildHistogramOption, getHistogramColors } from 'lib/echarts/options/histogram';
import { getHiddenSeriesNames } from 'lib/grafana/fields/seriesConfig';
import {
  type BaseOptionParts,
  type ChartContext,
  type ChartDataIssue,
  type EChartCartesianSeriesOption,
} from './types';

// The histogram mode of the cartesian panel (`PanelOptions.histogram`). The cartesian chart module calls
// these functions when the mode is on.

// `getDataIssue`, `buildOption` and `buildLegendItems` run on the same render. The last model of each
// frames array is kept, so the frames are bucketed once. https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
const modelCache = new WeakMap<DataFrame[], { key: string; model: HistogramModel | undefined }>();

function getModel(ctx: ChartContext): HistogramModel | undefined {
  const key = JSON.stringify(getHistogramOptions(ctx.options));
  const cached = modelCache.get(ctx.frames);
  if (cached?.key === key) {
    return cached.model;
  }
  const model = buildHistogramModel(ctx.frames, getHistogramOptions(ctx.options), ctx.theme);
  modelCache.set(ctx.frames, { key, model });
  return model;
}

/**
 * The data issue of the histogram, in this order:
 * 1. More buckets than `MAX_HISTOGRAM_BUCKETS`.
 * 2. Buckets with names (heatmap-rows `le` buckets). They need an ordinal axis, which the chart does not draw yet.
 */
export function getHistogramDataIssue(ctx: ChartContext): ChartDataIssue | undefined {
  const model = getModel(ctx);
  if (model && model.xMin.values.length > MAX_HISTOGRAM_BUCKETS) {
    return {
      reason: 'histogram-too-many-buckets',
      message:
        `The histogram has ${model.xMin.values.length} buckets. The limit is ${MAX_HISTOGRAM_BUCKETS}. ` +
        'Use a larger bucket size or a smaller bucket count.',
    };
  }
  if (model && isOrdinalHistogram(model)) {
    return {
      reason: 'histogram-ordinal-buckets',
      message: 'The histogram cannot draw buckets that have names. Use buckets with number bounds (xMin, xMax).',
    };
  }
  return undefined;
}

/** The histogram option, or `null` when the frames have no histogram ("No histogram found in response"). */
export function buildHistogramChartOption(
  ctx: ChartContext,
  { isGrafanaLegend, plotWidth }: BaseOptionParts
): EChartCartesianSeriesOption | null {
  if (getHistogramDataIssue(ctx)) {
    return null;
  }
  const model = getModel(ctx);
  if (!model) {
    return null;
  }
  return buildHistogramOption({
    model,
    theme: ctx.theme,
    options: ctx.options,
    fieldConfig: ctx.fieldConfig,
    isGrafanaLegend,
    plotWidth,
    tooltipSink: ctx.tooltipSink,
  });
}

/**
 * One legend item for each count field. A field hidden from the chart stays in the legend, so it can be
 * shown again. The legend calcs are not given (see the parity doc of the cartesian panel).
 */
export function buildHistogramLegendItems(ctx: ChartContext): VizLegendItem[] {
  const model = getModel(ctx);
  if (!model) {
    return [];
  }
  const colors = getHistogramColors(model, ctx.theme);
  const hidden = getHiddenSeriesNames(ctx.fieldConfig, model.names);
  return model.names.map((name, index) => ({
    label: name,
    fieldName: name,
    color: colors[index],
    yAxis: 1,
    disabled: hidden.has(name),
    getItemKey: () => `histogram-${index}`,
  }));
}
