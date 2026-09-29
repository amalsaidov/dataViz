import { type PanelOptionsEditorBuilder } from '@grafana/data';
import {
  cartesianAxisCategoryName,
  xTickLabelMaxLengthPath,
  xTickLabelSpacingOptions,
  xTickLabelSpacingPath,
} from 'editor/cartesian';
import { type PanelOptions } from 'types';

/**
 * Register the core Bar chart x tick label options: the "X-axis tick
 * label max length" (only with rotated labels, as core) and the "X-axis labels
 * minimum spacing". Category x-axis only. Rendered by `getCategoryTickLabel`.
 */
export function addCartesianXTickLabelOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addNumberInput({
    category: [cartesianAxisCategoryName],
    path: xTickLabelMaxLengthPath,
    name: 'X-axis tick label max length',
    description: 'X-axis labels longer than this are cut, with an ellipsis. Rotated labels only.',
    settings: { placeholder: 'None', min: 0, integer: true },
    showIf: (options) => (options.xTickRotate ?? 0) !== 0,
  });
  builder.addRadio({
    path: xTickLabelSpacingPath,
    name: 'X-axis labels minimum spacing',
    category: [cartesianAxisCategoryName],
    defaultValue: 0,
    settings: { options: xTickLabelSpacingOptions },
  });
}
