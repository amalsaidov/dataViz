import { type PanelOptionsEditorBuilder } from '@grafana/data';
import {
  barFillOpacityPath,
  CARTESIAN_BAR_FILL_OPACITY_DEFAULT,
  cartesianBarChartCategoryName,
} from 'editor/cartesian';
import { type PanelOptions } from 'types';
import { showIfSeriesTypes } from './series-types';

/**
 * Register the Default-tier "Bar fill opacity" input (0 to 100; core Bar chart "Fill
 * opacity", default 80). The bar border keeps the solid series color. Rendered
 * by `getBarItemStyle`.
 */
export function addCartesianBarFillOpacityOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addNumberInput({
    category: [cartesianBarChartCategoryName],
    path: barFillOpacityPath,
    name: 'Bar fill opacity',
    description: 'Fill opacity of bars (0–100). The border stays solid.',
    defaultValue: CARTESIAN_BAR_FILL_OPACITY_DEFAULT,
    settings: { min: 0, max: 100, integer: true },
    showIf: showIfSeriesTypes(['bar'], { histogram: true }),
  });
}
