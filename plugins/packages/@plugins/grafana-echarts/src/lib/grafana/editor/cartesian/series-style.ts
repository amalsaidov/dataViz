import { type FieldConfigEditorBuilder } from '@grafana/data';
import { getGraphFieldOptions } from '@grafana/ui';
import { cartesianGraphStylesCategoryName } from 'editor/cartesian';
import { type EChartsGraphFieldConfig } from 'editor/types';

/**
 * Register the Point size and Show points field settings of core Time series, for overrides only. The panel
 * options set the defaults. A field value wins over the panel option (`resolveFieldStyleOptions`). Line width and
 * Fill opacity are registered by `addCartesianHistogramFieldConfig`, and each mode reads them per field.
 * Core source: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/timeseries/config.ts
 * https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-support-for-field-config
 */
export function addCartesianSeriesStyleFieldConfig(builder: FieldConfigEditorBuilder<EChartsGraphFieldConfig>) {
  const category = [cartesianGraphStylesCategoryName];
  const description = 'Empty uses the panel option.';
  builder
    .addSliderInput({
      path: 'pointSize',
      name: 'Point size',
      category,
      description,
      settings: { min: 0, max: 40, step: 1 },
      hideFromDefaults: true,
    })
    .addRadio({
      path: 'showPoints',
      name: 'Show points',
      category,
      description,
      settings: { options: getGraphFieldOptions().showPoints },
      hideFromDefaults: true,
    });
}
