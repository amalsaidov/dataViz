import { type StandardEditorProps } from '@grafana/data';
import { type ScaleDimensionConfig } from '@grafana/schema';
import { InlineField, InlineFieldRow, Stack } from '@grafana/ui';
import React from 'react';
import { DEFAULT_MARKER_STYLE } from 'lib/grafana/geo/dimensions';
import { GeoFieldSelect } from './GeoFieldSelect';
import { GeoFixedNumberInput } from './GeoFixedNumberInput';
import { type NumberRange, validateScale } from './numberRange';

/**
 * A scale dimension (the marker size), as core `ScaleDimensionEditor`: a field select with a "Fixed value" option.
 * The fixed mode shows the value, the field mode shows the min and the max. Each is in the range of the settings.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/features/dimensions/editors/ScaleDimensionEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/forms-inlinefield--docs
 */
export const GeoScaleDimensionEditor = ({
  value,
  onChange,
  item,
  context,
}: StandardEditorProps<ScaleDimensionConfig | undefined, NumberRange>) => {
  const cfg: ScaleDimensionConfig = value ?? DEFAULT_MARKER_STYLE.size;
  const range = item.settings ?? { min: 1, max: 100 };
  const change = (next: Partial<ScaleDimensionConfig>) => onChange(validateScale({ ...cfg, ...next }, range));
  const number = (key: 'fixed' | 'min' | 'max', label: string) => (
    <InlineFieldRow>
      <InlineField label={label} labelWidth={8} grow>
        <GeoFixedNumberInput
          aria-label={`Size ${label.toLowerCase()}`}
          value={cfg[key]}
          min={range.min}
          max={range.max}
          onChange={(v) => change({ [key]: v })}
        />
      </InlineField>
    </InlineFieldRow>
  );
  return (
    <Stack direction="column" gap={1}>
      <GeoFieldSelect
        aria-label="Size field"
        frames={context.data}
        field={cfg.field}
        fixedLabel="Fixed value"
        onChange={(field) => change({ field })}
      />
      {cfg.field ? (
        <div>
          {number('min', 'Min')}
          {number('max', 'Max')}
        </div>
      ) : (
        number('fixed', 'Value')
      )}
    </Stack>
  );
};
