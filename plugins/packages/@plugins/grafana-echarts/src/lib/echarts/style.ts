import {
  type DataFrame,
  type Field,
  FieldType,
  formattedValueToString,
  getDisplayProcessor,
  getFieldSeriesColor,
  type GrafanaTheme2,
  type ValueFormatter,
} from '@grafana/data';
import { type CallbackDataParams } from 'echarts/types/dist/shared';
import { getNoValueText } from 'lib/grafana/fields/fieldConfig';

/**
 * Resolve the color to use for an entire series/slice from a Grafana field.
 *
 * Uses the field's standard Color scheme config (`field.config.color`). For
 * by-series modes (e.g. the classic palette) this resolves via the field's
 * series index; for by-value modes it colors by the field's reduced value.
 *
 * Falls back to a theme color when no usable color can be derived so callers
 * always receive a renderable string.
 */
export function getSeriesColor(field: Field, theme: GrafanaTheme2): string {
  const seriesColor = getFieldSeriesColor(field, theme).color;
  if (seriesColor) {
    return seriesColor;
  }

  return theme.visualization.getColorByName('text');
}

/** Field types that take a classic palette slot in core (`setClassicPaletteIdxs`). */
const PALETTE_FIELD_TYPES = new Set<FieldType>([FieldType.number, FieldType.boolean, FieldType.enum]);

/**
 * Series color for a cartesian field, with the classic palette counted over the
 * value fields only. Grafana's `applyFieldOverrides` gives every non-time field a
 * `seriesIndex`, so a label column moves each series one palette step. Core Time
 * series and Bar chart count only number, boolean and enum fields
 * (`setClassicPaletteIdxs` in `public/app/plugins/panel/timeseries/utils.ts`).
 * The label columns that come before the field are subtracted from its index, so
 * the result is the same after hidden value fields are removed from `frames`.
 */
export function getCartesianSeriesColor(field: Field, frames: DataFrame[], theme: GrafanaTheme2): string {
  const seriesIndex = field.state?.seriesIndex;
  if (seriesIndex == null) {
    return getSeriesColor(field, theme);
  }
  let skipped = 0;
  for (const frame of frames) {
    for (const other of frame.fields) {
      if (other === field) {
        const state = { ...field.state, seriesIndex: Math.max(0, seriesIndex - skipped) };
        return getSeriesColor({ ...field, state }, theme);
      }
      if (other.type !== FieldType.time && !PALETTE_FIELD_TYPES.has(other.type)) {
        skipped++;
      }
    }
  }
  return getSeriesColor(field, theme);
}

/**
 * Resolve a color from Grafana's classic visualization palette by index,
 * cycling when the index exceeds the palette length.
 * @todo is this not exposed from core Grafana to plugins?
 */
export function getPaletteColorByIndex(index: number, theme: GrafanaTheme2): string {
  const { palette } = theme.visualization;
  const name = palette[index % palette.length];
  return theme.visualization.getColorByName(name);
}

/**
 * Build a value formatter for a field, reusing the field's already-computed
 * `display` processor when Grafana has applied field overrides, and otherwise
 * constructing one from the field config + theme.
 *
 * The returned formatter is convenient for ECharts `tooltip.valueFormatter` and
 * axis label formatters so rendered values match the rest of Grafana.
 */
export function getValueFormatter(field: Field, theme: GrafanaTheme2, timeZone?: string): ValueFormatter {
  const display = field.display ?? getDisplayProcessor({ field, theme, timeZone });
  const noValue = getNoValueText(field);

  // Empty (null/undefined/NaN) values render the field's "No value" text rather
  // than the display processor's empty string, honoring the standard option in
  // tooltips. Axis label usage is unaffected (labels are always numeric).
  // `decimals` is the tick decimals of a value axis, as core `UPlotAxisBuilder`.
  return (value, decimals) =>
    value == null || (typeof value === 'number' && Number.isNaN(value)) ? { text: noValue } : display(value, decimals);
}

/**
 * Build one value formatter per field, preserving order so callers can index by
 * a series' position. Each formatter honors that field's own unit/decimals
 * overrides (via `getValueFormatter`), so heterogeneous units format correctly.
 */
export function getFieldValueFormatters(fields: Field[], theme: GrafanaTheme2, timeZone?: string): ValueFormatter[] {
  return fields.map((field) => getValueFormatter(field, theme, timeZone));
}

/**
 * Unwrap the value ECharts hands a data item. Array data items (cartesian
 * `[time, value]`, heatmap `[..., value]`) carry the numeric magnitude last;
 * scalar items are their own value.
 */
export function unwrapEChartsValue(eChartValue: CallbackDataParams['value']): CallbackDataParams['value'] {
  return Array.isArray(eChartValue) ? eChartValue[eChartValue.length - 1] : eChartValue;
}

/**
 * Format a raw ECharts data value with Grafana's field formatter. Used by the
 * tooltip rows and by the pie's slice / donut-centre labels.
 * See https://echarts.apache.org/en/option.html#tooltip.valueFormatter
 */
export function formatEChartsValue(
  eChartValue: CallbackDataParams['value'],
  grafanaFormatValue: ValueFormatter
): string {
  const numeric = unwrapEChartsValue(eChartValue);
  if (typeof numeric === 'number') {
    return formattedValueToString(grafanaFormatValue(numeric));
  }

  // Empty (null/undefined) values route through the field formatter as `NaN`,
  // which it renders as the field's standard "No value" text (see
  // `getValueFormatter`). `NaN` is used because `ValueFormatter` is typed to
  // accept a number, and the formatter treats `NaN` the same as null.
  if (numeric == null) {
    return formattedValueToString(grafanaFormatValue(NaN));
  }

  // A genuine non-null, non-numeric value (e.g. a category label).
  return String(numeric);
}
