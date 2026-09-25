import { dateTimeFormat } from '@grafana/data';
import { type TopLevelFormatterParams } from 'echarts/types/dist/shared';
import { fmtDuration } from 'lib/grafana/timeline/duration';
import { type TimelineLane, type TimelineSegment } from 'lib/grafana/timeline/types';
import { type TimelineTooltipContext, type TooltipModel } from 'lib/echarts/tooltip/types';

/** One drawn bar and the lane it belongs to, in series data order. */
export interface TimelineItem {
  lane: TimelineLane;
  laneIndex: number;
  segment: TimelineSegment;
}

/**
 * Per-bar tooltip for the timeline custom series, composed like core's
 * `StateTimelineTooltip` in Single mode: the start–end times in the header, the lane
 * row with the value and its colour swatch, then a "Duration" row. Status history
 * (`samples` mode) shows the sample time and the lane row only (`withDuration` false).
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/state-timeline/StateTimelineTooltip.tsx
 *
 * ECharts hands back the hovered item's `dataIndex` (item trigger), which indexes
 * `items` because the series data is encoded 1:1 from it.
 * https://echarts.apache.org/en/option.html#series-custom.tooltip
 */
export function buildTimelineTooltipModel(
  items: TimelineItem[],
  ctx: TimelineTooltipContext
): (params: TopLevelFormatterParams) => TooltipModel {
  const formatTime = (ms: number) => dateTimeFormat(ms, { timeZone: ctx.timeZone });

  return (params) => {
    const param = Array.isArray(params) ? params[0] : params;
    const item = param?.dataIndex != null ? items[param.dataIndex] : undefined;
    if (!item) {
      return { header: { label: '', value: '' }, rows: [] };
    }
    const { lane, segment } = item;
    const source = { field: lane.field, rowIndex: segment.rowIndex };
    const valueRow = { color: segment.color, label: lane.name, value: segment.text, source };

    if (ctx.mode === 'samples') {
      return { header: { label: '', value: formatTime(segment.start) }, rows: [valueRow], source };
    }

    return {
      // Core puts a line break after the dash.
      header: { label: '', value: `${formatTime(segment.start)} - \n${formatTime(segment.end)}` },
      rows: [valueRow, { label: 'Duration', value: fmtDuration(segment.end - segment.start) }],
      source,
    };
  };
}
