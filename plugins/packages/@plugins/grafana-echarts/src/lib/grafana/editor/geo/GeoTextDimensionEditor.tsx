import { type StandardEditorProps } from '@grafana/data';
import { type TextDimensionConfig, TextDimensionMode } from '@grafana/schema';
import { Button, Input } from '@grafana/ui';
import React from 'react';
import { GeoDimensionField } from './GeoDimensionField';

/**
 * A text dimension (the marker text label), as core `TextDimensionEditor`, in the fixed mode: the value, saved on
 * blur and on Enter, with a clear button. The Source radio and the field mode come in #566.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/features/dimensions/editors/TextDimensionEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-input--docs
 */
export const GeoTextDimensionEditor = ({ value, onChange }: StandardEditorProps<TextDimensionConfig | undefined>) => {
  if (value?.mode === TextDimensionMode.Field) {
    return <GeoDimensionField field={value.field ?? ''} />;
  }
  const fixed = value?.fixed ?? '';
  const commit = (next: string) => {
    if (next !== fixed) {
      onChange({ ...value, mode: TextDimensionMode.Fixed, fixed: next });
    }
  };
  return (
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
  );
};
