import { FieldType, type FieldConfigEditorBuilder, identityOverrideProcessor } from '@grafana/data';
import { type EChartsGraphFieldConfig } from 'editor/types';
import { SpanNullsEditor } from 'lib/grafana/editor/cartesian/SpanNullsEditor';

/**
 * Register the core Time series "Connect null values" field config (`custom.spanNulls`, default
 * `false`), with field overrides. It has core parity, so it is not an Advanced option (#404). The
 * core registration: `getGraphFieldConfig` in public/app/plugins/panel/timeseries/config.ts.
 * Rendered by `lib/echarts/converters/spanNulls.ts`.
 * https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors
 */
export function addCartesianSpanNullsFieldConfig(builder: FieldConfigEditorBuilder<EChartsGraphFieldConfig>) {
  builder.addCustomEditor<{}, boolean | number>({
    id: 'spanNulls',
    path: 'spanNulls',
    name: 'Connect null values',
    description: 'Draw the line across null values. Applies to line series.',
    category: ['Graph styles'],
    defaultValue: false,
    editor: SpanNullsEditor,
    override: SpanNullsEditor,
    shouldApply: (field) => field.type !== FieldType.time,
    process: identityOverrideProcessor,
  });
}
