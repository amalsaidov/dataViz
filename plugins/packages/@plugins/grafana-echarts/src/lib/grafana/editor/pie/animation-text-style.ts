import { type PanelOptionsEditorBuilder } from '@grafana/data';
import {
  PIE_LABEL_TEXT_SHADOW_DEFAULT,
  PIE_LABEL_TEXT_STROKE_DEFAULT,
  pieLabelTextShadowPath,
  pieLabelTextStrokePath,
} from 'editor/pie';
import { addAdvancedBooleanSwitch, type ExtraShowIf } from 'lib/grafana/editor/common/advanced-options';
import { type PanelOptions } from 'types';

/**
 * Register the Advanced pie label text style switches (lowest priority), in the
 * "Advanced" category. They re-enable the ECharts label shadow/stroke that
 * `getPieLabelStyle` zeroes by default. The Animation switch is not here: it applies
 * to each part-to-whole series type, so the module adds it with `addAnimationOption`.
 */
export function addPieTextStyleOptions(builder: PanelOptionsEditorBuilder<PanelOptions>, showIf?: ExtraShowIf) {
  addAdvancedBooleanSwitch(builder, {
    path: pieLabelTextShadowPath,
    name: 'Label text shadow',
    description: 'Draw a drop shadow behind slice labels',
    defaultValue: PIE_LABEL_TEXT_SHADOW_DEFAULT,
    showIf,
  });

  addAdvancedBooleanSwitch(builder, {
    path: pieLabelTextStrokePath,
    name: 'Label text stroke',
    description: 'Draw a contrast stroke around slice-label text',
    defaultValue: PIE_LABEL_TEXT_STROKE_DEFAULT,
    showIf,
  });
}
