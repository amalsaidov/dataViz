import { type DataFrame } from '@grafana/data';
import { Combobox } from '@grafana/ui';
import React from 'react';
import { fieldNameOptions, FIXED_OPTION_VALUE } from './fieldOptions';

interface Props {
  'aria-label': string;
  frames: DataFrame[];
  /** The field of the dimension. No field selects the fixed option. */
  field?: string;
  /** The label of the first option, the fixed mode. No label gives no fixed option. */
  fixedLabel?: string;
  /** Keep only the fields of this type, as the `fieldType` of core. */
  fieldType?: string;
  /** Called with the field, or with `undefined` for the fixed option. */
  onChange: (field: string | undefined) => void;
}

/**
 * The field select of a dimension editor, as the `Combobox` of the core dimension editors: a first "Fixed value"
 * option, then the fields of the layer frames.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/features/dimensions/editors/ScaleDimensionEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-combobox--docs
 */
export const GeoFieldSelect = ({ frames, field, fixedLabel, fieldType, onChange, ...rest }: Props) => {
  const fixed = fixedLabel ? [{ value: FIXED_OPTION_VALUE, label: fixedLabel }] : [];
  const options = [...fixed, ...fieldNameOptions(frames, field, fieldType)];
  const value = field ?? (fixedLabel ? FIXED_OPTION_VALUE : null);
  return (
    <Combobox<string>
      aria-label={rest['aria-label']}
      value={value}
      options={options}
      onChange={(v) => onChange(v && v.value !== FIXED_OPTION_VALUE ? v.value : undefined)}
      placeholder={fixedLabel ? undefined : 'Select field'}
    />
  );
};
