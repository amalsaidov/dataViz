import { type StandardEditorProps } from '@grafana/data';
import { type ScalarDimensionConfig } from '@grafana/schema';
import React from 'react';
import { DEFAULT_MARKER_STYLE } from 'lib/grafana/geo/dimensions';
import { GeoDimensionField } from './GeoDimensionField';
import { GeoFixedNumberInput } from './GeoFixedNumberInput';
import { type NumberRange } from './numberRange';

/**
 * A scalar dimension (the marker rotation), as core `ScalarDimensionEditor`, in the fixed mode: the value in the
 * range of the settings. The field select and the Mod and Clamped limit of the field mode come in #566.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/features/dimensions/editors/ScalarDimensionEditor.tsx
 */
export const GeoScalarDimensionEditor = ({
  value,
  onChange,
  item,
}: StandardEditorProps<ScalarDimensionConfig | undefined, NumberRange>) => {
  const cfg: ScalarDimensionConfig = value ?? DEFAULT_MARKER_STYLE.rotation;
  if (cfg.field) {
    return <GeoDimensionField field={cfg.field} />;
  }
  const { min, max } = item.settings ?? { min: cfg.min, max: cfg.max };
  return (
    <GeoFixedNumberInput
      aria-label="Rotation value"
      value={cfg.fixed}
      min={min}
      max={max}
      onChange={(fixed) => onChange({ ...cfg, fixed })}
    />
  );
};
