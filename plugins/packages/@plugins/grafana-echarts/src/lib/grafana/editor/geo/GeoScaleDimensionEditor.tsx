import { type StandardEditorProps } from '@grafana/data';
import { type ScaleDimensionConfig } from '@grafana/schema';
import { InlineField, InlineFieldRow, Stack } from '@grafana/ui';
import React from 'react';
import { DEFAULT_MARKER_STYLE } from 'lib/grafana/geo/dimensions';
import { GeoFieldSelect } from './GeoFieldSelect';
import { GeoFixedNumberInput } from './GeoFixedNumberInput';
import { type NumberRange, validateScale } from './numberRange';

/** The settings of the editor: the range, and the name of the value in the labels. */
export interface ScaleEditorSettings extends NumberRange {
  /** The name of the value in the labels. The default is `Size`. */
  label?: string;
  /** Show no min and max in the field mode, as core `hideRange`. */
  hideRange?: boolean;
}

/**
 * A scale dimension (the marker size or the heatmap weight), as core `ScaleDimensionEditor`: a field select with a "Fixed value" option.
 * The fixed mode shows the value, the field mode shows the min and the max. Each is in the range of the settings.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/features/dimensions/editors/ScaleDimensionEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/forms-inlinefield--docs
 */
export const GeoScaleDimensionEditor = ({
  value,
  onChange,
  item,
  context,
}: StandardEditorProps<ScaleDimensionConfig | undefined, ScaleEditorSettings>) => {
  const cfg: ScaleDimensionConfig = value ?? DEFAULT_MARKER_STYLE.size;
  const range = item.settings ?? { min: 1, max: 100 };
  const name = range.label ?? 'Size';
  const change = (next: Partial<ScaleDimensionConfig>) => onChange(validateScale({ ...cfg, ...next }, range));
  const number = (key: 'fixed' | 'min' | 'max', label: string) => (
    <InlineFieldRow>
      <InlineField label={label} labelWidth={8} grow>
        <GeoFixedNumberInput
          aria-label={`${name} ${label.toLowerCase()}`}
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
        aria-label={`${name} field`}
        frames={context.data}
        field={cfg.field}
        fixedLabel="Fixed value"
        onChange={(field) => change({ field })}
      />
      {cfg.field
        ? !range.hideRange && (
            <div>
              {number('min', 'Min')}
              {number('max', 'Max')}
            </div>
          )
        : number('fixed', 'Value')}
    </Stack>
  );
};
