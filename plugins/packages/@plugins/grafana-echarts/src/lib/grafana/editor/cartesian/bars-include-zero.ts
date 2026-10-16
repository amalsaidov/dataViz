import { type PanelOptionsEditorBuilder } from '@grafana/data';
import {
  barsIncludeZeroPath,
  CARTESIAN_BARS_INCLUDE_ZERO_DEFAULT,
  cartesianBarChartCategoryName,
} from 'editor/cartesian';
import { type PanelOptions } from 'types';
import { showIfBarOption } from './series-types';

/**
 * Register the cartesian "Include zero" switch for the value axes of bar series. On: the axis includes zero, as
 * core Bar chart. Off: the axis fits the data, as core Time series.
 * Builder: https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-options-to-panel
 * Core Time series range (`uPlot.rangeNum`):
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/config/UPlotScaleBuilder.ts
 */
export function addCartesianBarsIncludeZeroOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addBooleanSwitch({
    category: [cartesianBarChartCategoryName],
    path: barsIncludeZeroPath,
    name: 'Include zero',
    description: 'The value axis of bar series includes zero. Off fits the axis to the data.',
    defaultValue: CARTESIAN_BARS_INCLUDE_ZERO_DEFAULT,
    showIf: showIfBarOption,
  });
}
