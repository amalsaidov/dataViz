import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { barWidthPath, CARTESIAN_BAR_WIDTH_DEFAULT, cartesianBarChartCategoryName } from 'editor/cartesian';
import { type PanelOptions } from 'types';
import { showIfBarOption } from './series-types';

/**
 * Register the Default-tier cartesian "Bar width" input (percentage of the category
 * band; ECharts `series.barWidth`). Only affects `bar` series; empty uses
 * ECharts' auto width. Rendered by `getBarWidth`.
 */
export function addCartesianBarWidthOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addNumberInput({
    category: [cartesianBarChartCategoryName],
    path: barWidthPath,
    name: 'Bar width',
    description: 'Bar width as a percentage of the category band (bar series). Empty uses auto width.',
    defaultValue: CARTESIAN_BAR_WIDTH_DEFAULT,
    settings: { min: 1, max: 100, integer: true },
    showIf: showIfBarOption,
  });
}
