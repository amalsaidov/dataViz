import { histogramFieldInfo, type PanelOptionsEditorBuilder } from '@grafana/data';
import { histogramCategoryName, histogramPath } from 'editor/cartesian';
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
      description: histogramFieldInfo.bucketSize.description,
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
