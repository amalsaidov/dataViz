import { Input } from '@grafana/ui';
import React from 'react';
import { clampFixed } from './numberRange';

interface Props {
  'aria-label': string;
  value?: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
}

/**
 * The fixed value of a number dimension, as the core `NumberInput`: it saves on blur and on Enter, in the range
 * `min` to `max`. The row key is the value, so a new value from the options gives a new draft.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/core/components/OptionsUI/NumberInput.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/inputs-input--docs
 */
export const GeoFixedNumberInput = ({ value, min, max, onChange, ...rest }: Props) => {
  const commit = (text: string) => {
    const next = clampFixed(text, min, max);
    if (next !== undefined && next !== value) {
      onChange(next);
    }
  };
  return (
    <Input
      key={value}
      aria-label={rest['aria-label']}
      type="number"
      min={min}
      max={max}
      defaultValue={value}
      onBlur={(e) => commit(e.currentTarget.value)}
      onKeyDown={(e) => e.key === 'Enter' && commit(e.currentTarget.value)}
    />
  );
};
