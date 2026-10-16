import { type StandardEditorProps } from '@grafana/data';
import { type TextDimensionConfig, TextDimensionMode } from '@grafana/schema';
import { Button, InlineField, InlineFieldRow, Input, RadioButtonGroup } from '@grafana/ui';
import React from 'react';
import { GeoFieldSelect } from './GeoFieldSelect';

const SOURCE_OPTIONS = [
  { label: 'Fixed', value: TextDimensionMode.Fixed, description: 'Fixed value' },
  { label: 'Field', value: TextDimensionMode.Field, description: 'Display field value' },
];

const LABEL_WIDTH = 9;

/**
 * A text dimension (the marker text label), as core `TextDimensionEditor`: the Source radio (Fixed or Field). The
 * fixed mode shows the value, saved on blur and on Enter, with a clear button. The field mode shows a field select.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/features/dimensions/editors/TextDimensionEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-input--docs
 */
export const GeoTextDimensionEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<TextDimensionConfig | undefined>) => {
  const mode = value?.mode ?? TextDimensionMode.Fixed;
  const fixed = value?.fixed ?? '';
  const commit = (next: string) => {
    if (next !== fixed) {
      onChange({ ...value, mode, fixed: next });
    }
  };
  return (
    <>
      <InlineFieldRow>
        <InlineField label="Source" labelWidth={LABEL_WIDTH} grow>
          <RadioButtonGroup
            value={mode}
            options={SOURCE_OPTIONS}
            onChange={(next) => onChange({ fixed, ...value, mode: next })}
            fullWidth
          />
        </InlineField>
      </InlineFieldRow>
      {mode === TextDimensionMode.Fixed ? (
        <InlineFieldRow>
          <InlineField label="Value" labelWidth={LABEL_WIDTH} grow>
            <Input
              key={fixed}
              aria-label="Text label value"
              defaultValue={fixed}
              onBlur={(e) => commit(e.currentTarget.value)}
              onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
              suffix={
                fixed && (
                  <Button
                    aria-label="Clear value"
                    icon="times"
                    variant="secondary"
                    fill="text"
                    size="sm"
                    onClick={() => commit('')}
                  />
                )
              }
            />
          </InlineField>
        </InlineFieldRow>
      ) : (
        <InlineFieldRow>
          <InlineField label="Field" labelWidth={LABEL_WIDTH} grow>
            <GeoFieldSelect
              aria-label="Text label field"
              frames={context.data}
              field={value?.field}
              onChange={(field) => onChange({ fixed, ...value, mode, field })}
            />
          </InlineField>
        </InlineFieldRow>
      )}
    </>
  );
};
