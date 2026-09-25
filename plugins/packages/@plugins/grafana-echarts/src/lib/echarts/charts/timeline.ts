import { type DataFrame, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { type XAXisOption } from 'echarts/types/src/coord/cartesian/AxisModel';
import { resolveTimelineOptions } from 'editor/timeline';
import { getCartesianGrid } from 'lib/echarts/grid/grid';
import {
  cartesianTimeDefaultOptions,
  getCartesianAxisStyle,
  getTimeAxisBounds,
  mergeAxisStyle,
} from 'lib/echarts/options/cartesian';
import { DEFAULT_CHART_LEGEND } from 'lib/echarts/options/legend';
import {
  getTimelineLaneBands,
  getTimelineSeries,
  getTimelineYAxis,
  timelineValueFont,
} from 'lib/echarts/options/timeline';
import { prepareTimeline } from 'lib/grafana/timeline/prepareTimeline';
import { type TimelinePrepareResult } from 'lib/grafana/timeline/types';
import { getTimeAxisLabelFormatter } from 'lib/grafana/timeAxisFormat';
import { type ChartContext, type ChartModule, type EChartTimelineOption } from './types';

/**
 * Timeline chart family (state timeline): one lane per value field, one bar per state,
 * drawn with an ECharts `custom` series. Data prep is the Grafana side
 * (`lib/grafana/timeline`), the series is the ECharts side (`options/timeline.ts`).
 * See `data-plane/timeline.md` and `modules/state-timeline/parity.md`.
 */

interface PrepareInput {
  mergeValues: boolean;
  timeRange: TimeRange;
  theme: GrafanaTheme2;
}

interface PrepareCacheEntry {
  input: PrepareInput;
  result: TimelinePrepareResult;
}

// `getDataIssue`, `buildOption` and `buildLegendItems` run on the same render; keep
// the last result so the frames are joined once. The key is the frames array of each
// panel, so panels do not overwrite each other's entry. See
// https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/WeakMap
const prepareCache = new WeakMap<DataFrame[], PrepareCacheEntry>();

function prepare(ctx: ChartContext): TimelinePrepareResult {
  const input: PrepareInput = {
    mergeValues: resolveTimelineOptions(ctx.options).mergeValues,
    timeRange: ctx.timeRange,
    theme: ctx.theme,
  };
  const cached = prepareCache.get(ctx.frames);
  if (
    cached &&
    cached.input.mergeValues === input.mergeValues &&
    cached.input.timeRange === input.timeRange &&
    cached.input.theme === input.theme
  ) {
    return cached.result;
  }
  const result = prepareTimeline(ctx.frames, input);
  prepareCache.set(ctx.frames, { input, result });
  return result;
}

export const timelineChartModule: ChartModule = {
  legend: DEFAULT_CHART_LEGEND,

  // Multi ("All") needs a hit test per lane at the hovered time. See
  // `todo/timeline-core-parity.md`.
  singleTooltipOnly: true,

  legendReadonly: true,

  getDataIssue(ctx) {
    return prepare(ctx).issue;
  },

  buildOption(ctx, { isGrafanaLegend }): EChartTimelineOption | null {
    const { model } = prepare(ctx);
    if (!model || model.lanes.length === 0) {
      return null;
    }
    const { theme, timeRange, timeZone, options } = ctx;
    const { rowHeight, showValue, alignValue } = resolveTimelineOptions(options);
    const bands = getTimelineLaneBands(model.lanes.length, rowHeight);
    const axisStyle = getCartesianAxisStyle(theme);

    const xAxis = mergeAxisStyle<XAXisOption>(cartesianTimeDefaultOptions.xAxis, axisStyle, {
      ...getTimeAxisBounds(timeRange),
      axisLabel: { formatter: getTimeAxisLabelFormatter(timeRange, timeZone) },
      zlevel: options.zLevel?.axis,
    });
    const yAxis = getTimelineYAxis(model, bands, axisStyle.axisLabel, options.zLevel?.axis);

    return {
      ...cartesianTimeDefaultOptions,
      grid: getCartesianGrid(isGrafanaLegend ? undefined : options.legend),
      xAxis,
      yAxis,
      series: [
        getTimelineSeries(
          model,
          bands,
          { showValue, alignValue, font: timelineValueFont(theme.typography.fontFamily) },
          { timeZone, tooltipSink: ctx.tooltipSink },
          options.zLevel?.series
        ),
      ],
    };
  },

  buildLegendItems(ctx) {
    return prepare(ctx).model?.legendItems ?? [];
  },
};
