import { type PanelOptionsEditorBuilder } from '@grafana/data';
import {
  CARTESIAN_SHOW_VALUES_DEFAULT,
  CARTESIAN_VALUE_LABEL_POSITION_DEFAULT,
  cartesianValueLabelsCategoryName,
  showValuesName,
  showValuesOptions,
  showValuesPath,
  valueLabelPositionOptions,
  valueLabelPositionPath,
} from 'editor/cartesian';
import { addAdvancedSelect } from 'lib/grafana/editor/common/advanced-options';
import { type PanelOptions } from 'types';
import { showIfValueLabelOption } from './series-types';

/**
 * Register the cartesian value-label options: the Default-tier "Show values"
 * radio (Auto / Always / Never, core Bar chart parity) plus the
 * Advanced-gated "Value label position" select (shown only once labels are drawn).
 * Both hide for the series types that draw no value labels. Rendered by `getCartesianValueLabel`.
 */
export function addCartesianValueLabelOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addRadio({
    path: showValuesPath,
    name: showValuesName,
    category: [cartesianValueLabelsCategoryName],
    description:
      'Show value labels. Auto labels the bars and hides the labels that overlap; Always labels every point.',
    defaultValue: CARTESIAN_SHOW_VALUES_DEFAULT,
    settings: { options: showValuesOptions },
    showIf: showIfValueLabelOption,
  });

  addAdvancedSelect(builder, {
    path: valueLabelPositionPath,
    name: 'Value label position',
    description: 'Where value labels render relative to the point/bar',
    defaultValue: CARTESIAN_VALUE_LABEL_POSITION_DEFAULT,
    settings: { options: valueLabelPositionOptions },
    // Only meaningful once labels are shown.
    showIf: (options, ...rest) => options.showValues !== 'never' && showIfValueLabelOption(options, ...rest),
  });
}
