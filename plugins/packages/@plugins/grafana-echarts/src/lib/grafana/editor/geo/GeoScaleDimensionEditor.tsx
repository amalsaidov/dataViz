import { type StandardEditorProps } from '@grafana/data';
import { type ScaleDimensionConfig } from '@grafana/schema';
import React from 'react';
import { DEFAULT_MARKER_STYLE } from 'lib/grafana/geo/dimensions';
import { GeoDimensionField } from './GeoDimensionField';
import { GeoFixedNumberInput } from './GeoFixedNumberInput';
import { type NumberRange } from './numberRange';

/**
 * A scale dimension (the marker size), as core `ScaleDimensionEditor`, in the fixed mode: the value in the range
 * of the settings. The field select and the min and max of the field mode come in #566.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/features/dimensions/editors/ScaleDimensionEditor.tsx
 */
export const GeoScaleDimensionEditor = ({
  value,
  onChange,
  item,
}: StandardEditorProps<ScaleDimensionConfig | undefined, NumberRange>) => {
  const cfg: ScaleDimensionConfig = value ?? DEFAULT_MARKER_STYLE.size;
  if (cfg.field) {
    return <GeoDimensionField field={cfg.field} />;
  }
  const { min, max } = item.settings ?? { min: 1, max: 100 };
  return (
    <GeoFixedNumberInput
      aria-label="Size value"
      value={cfg.fixed}
      min={min}
      max={max}
      onChange={(fixed) => onChange({ ...cfg, fixed })}
    />
  );
};
