import { type FieldConfigEditorBuilder, histogramFieldInfo, type PanelOptionsEditorBuilder } from '@grafana/data';
import { commonOptionsBuilder, getGraphFieldOptions } from '@grafana/ui';
import { histogramCategoryName, histogramPath } from 'editor/cartesian';
import { type EChartsGraphFieldConfig } from 'editor/types';
import { type PanelOptions } from 'types';

const isHistogram = (options: PanelOptions) => options.histogram === true;

/**
 * Register the "Histogram" switch and the bucket options of the core Histogram panel: Bucket count, Bucket size,
 * Bucket offset and Combine series. The names and descriptions are the core texts of `histogramFieldInfo`. Rendered
 * by `buildHistogramOption`.
 * https://grafana.com/developers/plugin-tools/reference/panel-options
 */
export function addCartesianHistogramOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  const category = [histogramCategoryName];
  builder
    .addBooleanSwitch({
      path: histogramPath,
      name: 'Histogram',
      category,
      description: 'Draw the bucket counts of the numeric fields, as the core Histogram panel. Series type is ignored.',
    })
    .addNumberInput({
      path: 'bucketCount',
      name: histogramFieldInfo.bucketCount.name,
      category,
      description: histogramFieldInfo.bucketCount.description,
      settings: { placeholder: 'Default: 30', min: 0 },
      showIf: isHistogram,
    })
    .addNumberInput({
      path: 'bucketSize',
      name: histogramFieldInfo.bucketSize.name,
      category,
      // Grafana gives no description for the bucket size.
      description:
        histogramFieldInfo.bucketSize.description ?? 'The size of each bucket. Empty picks a size from the data.',
      settings: { placeholder: 'Auto', min: 0 },
      showIf: isHistogram,
    })
    .addNumberInput({
      path: 'bucketOffset',
      name: histogramFieldInfo.bucketOffset.name,
      category,
      description: histogramFieldInfo.bucketOffset.description,
      settings: { placeholder: 'Default: 0', min: 0 },
      showIf: isHistogram,
    })
    .addBooleanSwitch({
      path: 'combine',
      name: histogramFieldInfo.combine.name,
      category,
      description: histogramFieldInfo.combine.description,
      showIf: isHistogram,
    });
}

/**
 * Register the field settings of the core Histogram panel: Stacking (with a group in an override), Line width,
 * Fill opacity and Gradient mode. The histogram mode reads them from each field (`getHistogramFieldStyles`). The
 * time series and category modes read Line width and Fill opacity per field (`resolveFieldStyleOptions`).
 * They have no default value. Thus a panel with no field setting keeps its panel options (`stacking`,
 * `barFillOpacity` and `lineWidth`).
 * Core source: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/module.tsx
 * https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-support-for-field-config
 */
export function addCartesianHistogramFieldConfig(builder: FieldConfigEditorBuilder<EChartsGraphFieldConfig>) {
  const category = [histogramCategoryName];
  const description = 'Empty uses the panel option.';
  commonOptionsBuilder.addStackingConfig(builder, undefined, category);
  builder
    .addSliderInput({
      path: 'lineWidth',
      name: 'Line width',
      category,
      description,
      settings: { min: 0, max: 10, step: 1 },
    })
    .addSliderInput({
      path: 'fillOpacity',
      name: 'Fill opacity',
      category,
      description,
      settings: { min: 0, max: 100, step: 1 },
    })
    .addRadio({
      path: 'gradientMode',
      name: 'Gradient mode',
      category,
      description: 'Histogram mode. Empty uses None.',
      settings: { options: getGraphFieldOptions().fillGradient },
    });
}
