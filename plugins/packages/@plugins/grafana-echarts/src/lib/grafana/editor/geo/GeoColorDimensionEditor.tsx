import { type StandardEditorProps } from '@grafana/data';
import { type ColorDimensionConfig } from '@grafana/schema';
import { ColorPicker, Stack } from '@grafana/ui';
import React from 'react';
import { DEFAULT_MARKER_STYLE } from 'lib/grafana/geo/dimensions';
import { GeoFieldSelect } from './GeoFieldSelect';

/**
 * A color dimension (the marker color), as core `ColorDimensionEditor`: a field select with a "Fixed color" option.
 * The fixed mode also shows a color picker with the named theme colors.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/features/dimensions/editors/ColorDimensionEditor.tsx
 * https://developers.grafana.com/ui/latest/index.html?path=/docs/pickers-colorpicker--docs
 */
export const GeoColorDimensionEditor = ({
  value,
  onChange,
  context,
}: StandardEditorProps<ColorDimensionConfig | undefined>) => {
  const cfg: ColorDimensionConfig = value ?? DEFAULT_MARKER_STYLE.color;
  const fixed = cfg.fixed ?? DEFAULT_MARKER_STYLE.color.fixed;
  return (
    <Stack alignItems="center" gap={1}>
      <GeoFieldSelect
        aria-label="Color field"
        frames={context.data}
        field={cfg.field}
        fixedLabel="Fixed color"
        onChange={(field) => onChange({ ...cfg, field, fixed })}
      />
      {!cfg.field && (
        <ColorPicker
          color={fixed}
          enableNamedColors
          onChange={(color) => onChange({ field: undefined, fixed: color })}
        />
      )}
    </Stack>
  );
};
