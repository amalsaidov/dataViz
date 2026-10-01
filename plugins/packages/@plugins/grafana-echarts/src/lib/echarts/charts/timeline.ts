import { type DataFrame, type GrafanaTheme2, type TimeRange } from '@grafana/data';
import { TooltipDisplayMode } from '@grafana/schema';
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
import { type TimelineMode, type TimelineModel, type TimelinePrepareResult } from 'lib/grafana/timeline/types';
import { getTimeAxisLabelFormatter } from 'lib/grafana/timeAxisFormat';
import { NOOP_TOOLTIP_SINK } from 'lib/echarts/tooltip/model';
import { getSilentTooltipOption } from 'lib/echarts/tooltip/option';
import { buildTimelineMultiTooltipModel } from 'lib/echarts/tooltip/timeline';
import { type ChartContext, type ChartModule, type EChartTimelineOption } from './types';

/**
 * Timeline chart family (state timeline and status history): one lane per value field,
 * one bar per state or one cell per sample, drawn with an ECharts `custom` series. Data prep is the Grafana side
 * (`lib/grafana/timeline`), the series is the ECharts side (`options/timeline.ts`).
 * See `data-plane/timeline.md`, `modules/state-timeline/parity.md` and
 * `modules/status-history/parity.md`.
 */

/** The status history family draws core's Samples mode; every other caller Changes. */
export const timelineMode = (ctx: Pick<ChartContext, 'family'>): TimelineMode =>
  ctx.family === 'status-history' ? 'samples' : 'changes';

interface PrepareInput {
  mergeValues: boolean;
  mode: TimelineMode;
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
    mode: timelineMode(ctx),
    timeRange: ctx.timeRange,
    theme: ctx.theme,
  };
  const cached = prepareCache.get(ctx.frames);
  if (
    cached &&
    cached.input.mergeValues === input.mergeValues &&
    cached.input.mode === input.mode &&
    cached.input.timeRange === input.timeRange &&
    cached.input.theme === input.theme
  ) {
    return cached.result;
  }
  const result = prepareTimeline(ctx.frames, input);
  prepareCache.set(ctx.frames, { input, result });
  return result;
}

/**
 * Status history cell width in milliseconds: `colWidth` of the first sample interval,
 * as core's Samples mode. With one sample there is no interval and no cell.
 */
function getSampleCellWidth(model: TimelineModel, colWidth: number): number {
  return (model.sampleInterval ?? 0) * colWidth;
}

/**
 * Status history X range: the time range, padded by half an interval at an edge that
 * the samples reach, so the edge cells show in full. Core's Samples `xRange`.
 */
function getSampleAxisBounds(model: TimelineModel, timeRange: TimeRange): { min: number; max: number } {
  const bounds = getTimeAxisBounds(timeRange);
  let first = Infinity;
  let last = -Infinity;
  for (const lane of model.lanes) {
    for (const { start } of lane.segments) {
      first = Math.min(first, start);
      last = Math.max(last, start);
    }
  }
  if (model.sampleInterval == null || first > last) {
    return bounds;
  }
  const pad = model.sampleInterval / 2;
  return {
    min: bounds.min <= first ? first - pad : bounds.min,
    max: bounds.max >= last ? last + pad : bounds.max,
  };
}

export const timelineChartModule: ChartModule = {
  legend: DEFAULT_CHART_LEGEND,

  // "All" uses the `axis` trigger, which gives the hovered time; each lane is then
  // searched for its state at that time. Single and Hidden use the panel tooltip.
  // https://echarts.apache.org/en/option.html#tooltip.trigger
  getTooltipOption(ctx) {
    const { model } = prepare(ctx);
    if (ctx.options.tooltip?.mode !== TooltipDisplayMode.Multi || !model) {
      return undefined;
    }
    const cellWidth =
      timelineMode(ctx) === 'samples'
        ? getSampleCellWidth(model, resolveTimelineOptions(ctx.options).colWidth)
        : undefined;
    const produce = buildTimelineMultiTooltipModel(model, { timeZone: ctx.timeZone }, cellWidth);
    return getSilentTooltipOption('axis', TooltipDisplayMode.Multi, produce, ctx.tooltipSink ?? NOOP_TOOLTIP_SINK);
  },

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
    const { rowHeight, showValue, alignValue, colWidth } = resolveTimelineOptions(options);
    const mode = timelineMode(ctx);
    const cellWidth = mode === 'samples' ? getSampleCellWidth(model, colWidth) : undefined;
    const bands = getTimelineLaneBands(model.lanes.length, rowHeight);
    const axisStyle = getCartesianAxisStyle(theme);

    const xAxis = mergeAxisStyle<XAXisOption>(cartesianTimeDefaultOptions.xAxis, axisStyle, {
      ...(mode === 'samples' ? getSampleAxisBounds(model, timeRange) : getTimeAxisBounds(timeRange)),
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
          // Core centres the text of status history cells.
          {
            showValue,
            alignValue: mode === 'samples' ? 'center' : alignValue,
            font: timelineValueFont(theme.typography.fontFamily),
          },
          { timeZone, tooltipSink: ctx.tooltipSink, mode },
          options.zLevel?.series,
          cellWidth
        ),
      ],
    };
  },

  buildLegendItems(ctx) {
    return prepare(ctx).model?.legendItems ?? [];
  },
};
