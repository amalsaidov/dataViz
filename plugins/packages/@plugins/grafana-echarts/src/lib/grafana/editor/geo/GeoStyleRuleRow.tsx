import { ComparisonOperation } from '@grafana/schema';
import { ColorPicker, Combobox, IconButton, Input, Stack } from '@grafana/ui';
import { type GeoJsonStyleRule } from 'lib/grafana/geo/geojson';
import React from 'react';

/** The core `comparisonOperationOptions`. */
const OPERATIONS = [
  { value: ComparisonOperation.EQ, label: '==' },
  { value: ComparisonOperation.NEQ, label: '!=' },
  { value: ComparisonOperation.LT, label: '<' },
  { value: ComparisonOperation.LTE, label: '<=' },
  { value: ComparisonOperation.GT, label: '>' },
  { value: ComparisonOperation.GTE, label: '>=' },
];

interface Props {
  rule: GeoJsonStyleRule;
  onChange: (rule: GeoJsonStyleRule) => void;
  onDelete: () => void;
}

/**
 * One style rule of a GeoJSON layer, as core `StyleRuleEditor`: the feature property, the operation, the value, the
 * color and the opacity. Core gives a numeric input for the order operations, so the value is a number there. Core
 * lists the properties of the loaded features; here the property is a text input.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/editor/StyleRuleEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-combobox--docs
 */
export const GeoStyleRuleRow = ({ rule, onChange, onDelete }: Props) => {
  const check = rule.check ?? { property: '', operation: ComparisonOperation.EQ, value: '' };
  const isText = check.operation === ComparisonOperation.EQ || check.operation === ComparisonOperation.NEQ;
  const setCheck = (next: Partial<typeof check>) => onChange({ ...rule, check: { ...check, ...next } });
  const setStyle = (next: Partial<NonNullable<GeoJsonStyleRule['style']>>) =>
    onChange({ ...rule, style: { ...rule.style, ...next } });
  return (
    <Stack direction="column" gap={0.5}>
      <Stack gap={0.5} alignItems="center">
        <Input
          aria-label="Feature property"
          placeholder="Feature property"
          value={check.property}
          onChange={(e) => setCheck({ property: e.currentTarget.value })}
        />
        <Combobox
          aria-label="Comparison operator"
          width={8}
          value={check.operation}
          options={OPERATIONS}
          onChange={(v) => setCheck({ operation: v.value })}
        />
        <Input
          aria-label="Comparison value"
          placeholder="value"
          type={isText ? 'text' : 'number'}
          value={String(check.value)}
          onChange={(e) => setCheck({ value: isText ? e.currentTarget.value : Number(e.currentTarget.value) })}
        />
        <IconButton name="trash-alt" tooltip="Delete style rule" onClick={onDelete} />
      </Stack>
      <Stack gap={1} alignItems="center">
        <ColorPicker
          color={rule.style?.color?.fixed ?? 'dark-green'}
          onChange={(fixed) => setStyle({ color: { fixed } })}
        />
        <Input
          aria-label="Opacity"
          prefix="Opacity"
          type="number"
          min={0}
          max={1}
          step={0.1}
          width={16}
          value={rule.style?.opacity ?? 0.4}
          onChange={(e) => setStyle({ opacity: Number(e.currentTarget.value) })}
        />
      </Stack>
    </Stack>
  );
};
