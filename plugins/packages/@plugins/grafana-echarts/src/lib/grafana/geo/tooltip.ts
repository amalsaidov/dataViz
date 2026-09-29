// The tooltip rows of a marker, as core Geomap `DataHoverView` (`getDisplayValuesAndLinks`): one row for each field
// of the frame at the row of the marker.
// https://github.com/grafana/grafana/blob/main/public/app/features/visualization/data-hover/DataHoverView.tsx
import {
  type DataFrame,
  type Field,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  type GrafanaTheme2,
} from '@grafana/data';
import { type TimeZone } from '@grafana/schema';
import { getFieldConfigFromField } from 'lib/grafana/fields/fieldConfig';

/** One tooltip row of a marker: the field display name, the display text of the value and the source field. */
export interface MarkerTooltipRow {
  label: string;
  value: string;
  source: { field: Field; rowIndex: number };
}

/**
 * The rows of the marker at `rowIndex`. A field with `custom.hideFrom.tooltip` gives no row, as core. The value
 * text comes from the display processor of the field: its unit, decimals and value mappings.
 * https://grafana.com/developers/plugin-tools/key-concepts/data-frames
 */
export function getMarkerTooltipRows(
  frame: DataFrame,
  rowIndex: number,
  theme: GrafanaTheme2,
  timeZone?: TimeZone
): MarkerTooltipRow[] {
  return frame.fields
    .filter((field) => getFieldConfigFromField(field).custom?.hideFrom?.tooltip !== true)
    .map((field) => {
      const display = field.display ?? getDisplayProcessor({ field, theme, timeZone });
      return {
        label: getFieldDisplayName(field, frame),
        value: formattedValueToString(display(field.values[rowIndex])),
        source: { field, rowIndex },
      };
    });
}
