import { FieldType, type FieldConfigEditorBuilder } from '@grafana/data';
import { LineInterpolation } from '@grafana/schema';
import { getGraphFieldOptions } from '@grafana/ui';
import { cartesianGraphStylesCategoryName } from 'editor/cartesian';
import { type EChartsGraphFieldConfig } from 'editor/types';

/**
 * Register the core Time series "Line interpolation" field config (`custom.lineInterpolation`, default `linear`),
 * with field overrides. The options are the core options (`getGraphFieldOptions().lineInterpolation`), as text.
 * The core registration: `getGraphFieldConfig` in public/app/plugins/panel/timeseries/config.ts.
 * Rendered by `getLineInterpolation` in `lib/echarts/options/cartesian.ts`.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/#line-interpolation
 */
export function addCartesianLineInterpolationFieldConfig(builder: FieldConfigEditorBuilder<EChartsGraphFieldConfig>) {
  builder.addRadio({
    path: 'lineInterpolation',
    name: 'Line interpolation',
    description: 'The shape of the line between two points: linear, smooth, step before or step after.',
    category: [cartesianGraphStylesCategoryName],
    defaultValue: LineInterpolation.Linear,
    // The core options have icons (`gf-interpolation-*`) that the standalone editor does not ship, so only the
    // values and the labels are kept.
    settings: { options: getGraphFieldOptions().lineInterpolation.map(({ value, label }) => ({ value, label })) },
    shouldApply: (field) => field.type !== FieldType.time,
    // Only line series read it. A field-config `showIf` sees only the config of this field.
    showIf: (config) => config.seriesType === undefined || config.seriesType === 'Auto' || config.seriesType === 'line',
  });
}
