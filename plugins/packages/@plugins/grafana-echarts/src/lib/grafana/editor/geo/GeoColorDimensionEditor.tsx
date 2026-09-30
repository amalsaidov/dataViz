import { type StandardEditorProps } from '@grafana/data';
import { type ColorDimensionConfig } from '@grafana/schema';
import { ColorPicker } from '@grafana/ui';
import React from 'react';
import { DEFAULT_MARKER_STYLE } from 'lib/grafana/geo/dimensions';
import { GeoDimensionField } from './GeoDimensionField';

/**
 * A color dimension (the marker color), as core `ColorDimensionEditor`, in the fixed mode: a color picker with
 * the named theme colors. The field select of the field mode comes in #566.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/features/dimensions/editors/ColorDimensionEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/pickers-colorpicker--docs
 */
export const GeoColorDimensionEditor = ({ value, onChange }: StandardEditorProps<ColorDimensionConfig | undefined>) => {
  const cfg: ColorDimensionConfig = value ?? DEFAULT_MARKER_STYLE.color;
  if (cfg.field) {
    return <GeoDimensionField field={cfg.field} />;
  }
  return (
    <ColorPicker
      color={cfg.fixed ?? DEFAULT_MARKER_STYLE.color.fixed}
      enableNamedColors
      onChange={(fixed) => onChange({ ...cfg, fixed })}
    />
  );
};
