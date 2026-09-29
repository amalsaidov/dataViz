import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { CARTESIAN_POINT_SIZE_DEFAULT, cartesianGraphStylesCategoryName, pointSizePath } from 'editor/cartesian';
import { type PanelOptions } from 'types';

/**
 * Register the Default-tier cartesian "Point size" input (px; ECharts `symbolSize`).
 * `0` hides the points; empty uses ECharts' default symbol. Affects line/scatter
 * series. Rendered by `getCartesianSymbol`.
 */
export function addCartesianPointSizeOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder.addNumberInput({
    category: [cartesianGraphStylesCategoryName],
    path: pointSizePath,
    name: 'Point size',
    description: 'Marker size for line/scatter points (px). 0 hides the points.',
    defaultValue: CARTESIAN_POINT_SIZE_DEFAULT,
    settings: { min: 0, max: 40, integer: true },
  });
}
