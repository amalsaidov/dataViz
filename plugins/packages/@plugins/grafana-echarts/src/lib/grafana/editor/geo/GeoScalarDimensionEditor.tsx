import { FieldType, type StandardEditorProps } from '@grafana/data';
import { type ScalarDimensionConfig, ScalarDimensionMode } from '@grafana/schema';
import { InlineField, InlineFieldRow, RadioButtonGroup } from '@grafana/ui';
import React from 'react';
import { DEFAULT_MARKER_STYLE } from 'lib/grafana/geo/dimensions';
import { GeoFieldSelect } from './GeoFieldSelect';
import { GeoFixedNumberInput } from './GeoFixedNumberInput';
import { type NumberRange } from './numberRange';

const LIMIT_OPTIONS = [
  { label: 'Mod', value: ScalarDimensionMode.Mod, description: 'Use field values, mod from max' },
  { label: 'Clamped', value: ScalarDimensionMode.Clamped, description: 'Use field values, clamped to max and min' },
];

/**
 * A scalar dimension (the marker rotation), as core `ScalarDimensionEditor`: the Limit radio (Mod or Clamped), a
 * select of the number fields with a "Fixed value" option, and the value in the range of the settings.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/features/dimensions/editors/ScalarDimensionEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-radiobuttongroup--docs
 */
export const GeoScalarDimensionEditor = ({
  value,
  onChange,
  item,
  context,
}: StandardEditorProps<ScalarDimensionConfig | undefined, NumberRange>) => {
  const cfg: ScalarDimensionConfig = value ?? DEFAULT_MARKER_STYLE.rotation;
  const { min, max } = item.settings ?? { min: cfg.min, max: cfg.max };
  return (
    <>
      <InlineFieldRow>
        <InlineField label="Limit" labelWidth={8} grow>
          <RadioButtonGroup
            value={cfg.mode ?? ScalarDimensionMode.Mod}
            options={LIMIT_OPTIONS}
            onChange={(mode) => onChange({ ...cfg, mode })}
            fullWidth
          />
        </InlineField>
      </InlineFieldRow>
      <InlineFieldRow>
        <InlineField label="Field" labelWidth={8} grow>
          <GeoFieldSelect
            aria-label="Rotation field"
            frames={context.data}
            field={cfg.field}
            fixedLabel="Fixed value"
            fieldType={FieldType.number}
            onChange={(field) => onChange({ ...cfg, field, fixed: cfg.fixed ?? 0 })}
          />
        </InlineField>
      </InlineFieldRow>
      {!cfg.field && (
        <InlineFieldRow>
          <InlineField label="Value" labelWidth={8} grow>
            <GeoFixedNumberInput
              aria-label="Rotation value"
              value={cfg.fixed}
              min={min}
              max={max}
              onChange={(fixed) => onChange({ ...cfg, fixed })}
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </>
  );
};
