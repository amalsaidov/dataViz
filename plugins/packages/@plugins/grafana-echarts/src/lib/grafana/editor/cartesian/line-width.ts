import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { CARTESIAN_LINE_WIDTH_DEFAULT, cartesianGraphStylesCategoryName, lineWidthPath } from 'editor/cartesian';
import { type PanelOptions } from 'types';

/**
 * Register the Default-tier cartesian "Line width" input (px; ECharts
 * `lineStyle.width`). Only affects `line` series; empty uses ECharts' default.
 * Rendered by `getCartesianLineStyle`.
 */
export function addCartesianLineWidthOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addNumberInput({
    category: [cartesianGraphStylesCategoryName],
    path: lineWidthPath,
    name: 'Line width',
    description: 'Stroke width of line series (px). Empty uses the default.',
    defaultValue: CARTESIAN_LINE_WIDTH_DEFAULT,
    settings: { min: 0, max: 20, integer: true },
  });
}
