import { FieldType, type FieldConfigEditorBuilder, identityOverrideProcessor } from '@grafana/data';
import { type LineStyle } from '@grafana/schema';
import { type EChartsGraphFieldConfig } from 'editor/types';
import { LineStyleEditor } from 'lib/grafana/editor/cartesian/LineStyleEditor';

/**
 * Register the core Time series "Line style" field config (`custom.lineStyle`: `fill` solid, dash or dot,
 * and `dash` segment lengths), with field overrides. The core registration: `getGraphFieldConfig` in
 * public/app/plugins/panel/timeseries/config.ts. Rendered by `getCartesianLineStyle`.
 * https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors
 */
export function addCartesianLineStyleFieldConfig(builder: FieldConfigEditorBuilder<EChartsGraphFieldConfig>) {
  builder.addCustomEditor<{}, LineStyle>({
    id: 'lineStyle',
    path: 'lineStyle',
    name: 'Line style',
    description: 'Draw the line solid, dashed or dotted. Applies to line series.',
    category: ['Graph styles'],
    editor: LineStyleEditor,
    override: LineStyleEditor,
    shouldApply: (field) => field.type === FieldType.number,
    // Only line series read it, as "Connect null values" (`addCartesianSpanNullsFieldConfig`).
    showIf: (config) => config.seriesType === undefined || config.seriesType === 'Auto' || config.seriesType === 'line',
    process: identityOverrideProcessor,
  });
}
