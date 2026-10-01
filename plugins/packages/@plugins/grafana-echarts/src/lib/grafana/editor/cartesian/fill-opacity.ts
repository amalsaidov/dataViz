import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { CARTESIAN_FILL_OPACITY_DEFAULT, cartesianGraphStylesCategoryName, fillOpacityPath } from 'editor/cartesian';
import { type PanelOptions } from 'types';
import { showIfLineOption } from './series-types';

/**
 * Register the Default-tier cartesian "Fill opacity" input (0–100; ECharts
 * `areaStyle.opacity`). A non-zero value turns a `line` series into an area
 * chart; 0 is a plain line. Rendered by `getCartesianAreaStyle`.
 */
export function addCartesianFillOpacityOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addNumberInput({
    category: [cartesianGraphStylesCategoryName],
    path: fillOpacityPath,
    name: 'Fill opacity',
    description: 'Fill the area under line series (0–100). 0 is a plain line.',
    defaultValue: CARTESIAN_FILL_OPACITY_DEFAULT,
    settings: { min: 0, max: 100, integer: true },
    showIf: showIfLineOption,
  });
}
