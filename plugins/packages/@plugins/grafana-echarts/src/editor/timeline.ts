import { type SelectableValue } from '@grafana/data';
import { type TimelineValueAlignment, VisibilityMode } from '@grafana/schema';
import { type TimelineSeriesType } from 'editor/types';
import { type PanelOptions } from 'types';

/**
 * Timeline family editor constants. The option paths and defaults are core's state
 * timeline ones, so a panel switched from core keeps its settings:
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/state-timeline/panelcfg.gen.ts
 */

/** The family's routing type: the ECharts `custom` series draws the bars. */
export const timelineSeriesTypes: TimelineSeriesType[] = ['custom'];

export const TIMELINE_SHOW_VALUE_DEFAULT = VisibilityMode.Auto;
export const TIMELINE_ROW_HEIGHT_DEFAULT = 0.9;
export const TIMELINE_MERGE_VALUES_DEFAULT = true;
export const TIMELINE_ALIGN_VALUE_DEFAULT: TimelineValueAlignment = 'left';
export const TIMELINE_FILL_OPACITY_DEFAULT = 70;
export const TIMELINE_LINE_WIDTH_DEFAULT = 0;

export const timelineShowValueOptions: Array<SelectableValue<VisibilityMode>> = [
  { value: VisibilityMode.Auto, label: 'Auto' },
  { value: VisibilityMode.Always, label: 'Always' },
  { value: VisibilityMode.Never, label: 'Never' },
];

export const timelineAlignValueOptions: Array<SelectableValue<TimelineValueAlignment>> = [
  { value: 'left', label: 'Left' },
  { value: 'center', label: 'Center' },
  { value: 'right', label: 'Right' },
];

/** The timeline options with core's defaults for unset keys. */
export function resolveTimelineOptions(options: PanelOptions) {
  return {
    showValue: options.showValue ?? TIMELINE_SHOW_VALUE_DEFAULT,
    rowHeight: options.rowHeight ?? TIMELINE_ROW_HEIGHT_DEFAULT,
    mergeValues: options.mergeValues ?? TIMELINE_MERGE_VALUES_DEFAULT,
    alignValue: options.alignValue ?? TIMELINE_ALIGN_VALUE_DEFAULT,
  };
}
