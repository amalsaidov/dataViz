import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { barFillOpacityPath, CARTESIAN_BAR_FILL_OPACITY_DEFAULT } from 'editor/cartesian';
import { addAdvancedNumberInput } from 'lib/grafana/editor/common/advanced-options';
import { type PanelOptions } from 'types';

/**
 * Register the Advanced "Bar fill opacity" input (0 to 100; core Bar chart "Fill
 * opacity", default 80). The bar border keeps the solid series color. Rendered
 * by `getBarItemStyle`.
 */
export function addCartesianBarFillOpacityOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  addAdvancedNumberInput(builder, {
    path: barFillOpacityPath,
    name: 'Bar fill opacity',
    description: 'Fill opacity of bars (0–100). The border stays solid.',
    defaultValue: CARTESIAN_BAR_FILL_OPACITY_DEFAULT,
    settings: { min: 0, max: 100, integer: true },
  });
}
