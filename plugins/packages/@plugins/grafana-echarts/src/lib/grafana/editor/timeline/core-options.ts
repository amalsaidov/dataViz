import { type FieldConfigEditorBuilder, type PanelOptionsEditorBuilder } from '@grafana/data';
import {
  STATUS_HISTORY_COL_WIDTH_DEFAULT,
  TIMELINE_ALIGN_VALUE_DEFAULT,
  TIMELINE_FILL_OPACITY_DEFAULT,
  TIMELINE_LINE_WIDTH_DEFAULT,
  TIMELINE_MERGE_VALUES_DEFAULT,
  TIMELINE_ROW_HEIGHT_DEFAULT,
  TIMELINE_SHOW_VALUE_DEFAULT,
  timelineAlignValueOptions,
  timelineShowValueOptions,
} from 'editor/timeline';
import { type EChartsTimelineFieldConfig } from 'editor/types';
import { type PanelOptions } from 'types';

/**
 * Core Grafana timeline options under core's own paths, names and categories, so a
 * panel switched from core keeps its settings. One function per option, so each
 * timeline panel picks its own set and defaults.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/state-timeline/
 * https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors
 */

type Builder = PanelOptionsEditorBuilder<PanelOptions>;
type FieldBuilder = FieldConfigEditorBuilder<EChartsTimelineFieldConfig>;

export function addMergeValuesOption(builder: Builder, category: string[]) {
  builder.addBooleanSwitch({
    path: 'mergeValues',
    name: 'Merge equal consecutive values',
    category,
    defaultValue: TIMELINE_MERGE_VALUES_DEFAULT,
  });
}

export function addShowValueOption(builder: Builder, category: string[]) {
  builder.addRadio({
    path: 'showValue',
    name: 'Show values',
    category,
    settings: { options: timelineShowValueOptions },
    defaultValue: TIMELINE_SHOW_VALUE_DEFAULT,
  });
}

export function addAlignValueOption(builder: Builder, category: string[]) {
  builder.addRadio({
    path: 'alignValue',
    name: 'Align values',
    category,
    settings: { options: timelineAlignValueOptions },
    defaultValue: TIMELINE_ALIGN_VALUE_DEFAULT,
  });
}

export function addRowHeightOption(builder: Builder, category: string[], defaultValue = TIMELINE_ROW_HEIGHT_DEFAULT) {
  builder.addSliderInput({
    path: 'rowHeight',
    name: 'Row height',
    category,
    settings: { min: 0, max: 1, step: 0.01 },
    defaultValue,
  });
}

/** Status history `colWidth`: the cell width as a part of the time between samples. */
export function addColWidthOption(builder: Builder, category: string[]) {
  builder.addSliderInput({
    path: 'colWidth',
    name: 'Column width',
    category,
    settings: { min: 0, max: 1, step: 0.01 },
    defaultValue: STATUS_HISTORY_COL_WIDTH_DEFAULT,
  });
}

/** `custom.lineWidth`: the bar border, in pixels. */
export function addLineWidthFieldOption(
  builder: FieldBuilder,
  category: string[],
  defaultValue = TIMELINE_LINE_WIDTH_DEFAULT
) {
  builder.addSliderInput({
    path: 'lineWidth',
    name: 'Line width',
    category,
    defaultValue,
    settings: { min: 0, max: 10, step: 1 },
  });
}

/** `custom.fillOpacity`: the bar fill, 0 to 100. */
export function addFillOpacityFieldOption(
  builder: FieldBuilder,
  category: string[],
  defaultValue = TIMELINE_FILL_OPACITY_DEFAULT
) {
  builder.addSliderInput({
    path: 'fillOpacity',
    name: 'Fill opacity',
    category,
    defaultValue,
    settings: { min: 0, max: 100, step: 1 },
  });
}
