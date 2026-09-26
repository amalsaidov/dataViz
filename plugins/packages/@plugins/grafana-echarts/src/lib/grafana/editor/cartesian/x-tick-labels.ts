import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { xTickLabelMaxLengthPath, xTickLabelSpacingOptions, xTickLabelSpacingPath } from 'editor/cartesian';
import { addAdvancedNumberInput } from 'lib/grafana/editor/common/advanced-options';
import { type PanelOptions } from 'types';

/**
 * Register the core Bar chart x tick label options: the Advanced "X-axis tick
 * label max length" (only with rotated labels, as core) and the "X-axis labels
 * minimum spacing". Category x-axis only. Rendered by `getCategoryTickLabel`.
 */
export function addCartesianXTickLabelOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  addAdvancedNumberInput(builder, {
    path: xTickLabelMaxLengthPath,
    name: 'X-axis tick label max length',
    description: 'X-axis labels longer than this are cut, with an ellipsis. Rotated labels only.',
    settings: { placeholder: 'None', min: 0, integer: true },
    showIf: (options) => (options.xTickRotate ?? 0) !== 0,
  });
  builder.addRadio({
    path: xTickLabelSpacingPath,
    name: 'X-axis labels minimum spacing',
    category: ['Axis'],
    defaultValue: 0,
    settings: { options: xTickLabelSpacingOptions },
  });
}
