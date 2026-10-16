import {
  FALLBACK_COLOR,
  type Field,
  FieldColorModeId,
  type FieldConfig,
  formattedValueToString,
  getValueFormat,
  type GrafanaTheme2,
  ThresholdsMode,
} from '@grafana/data';
import { type VizLegendItem } from '@grafana/ui';

/**
 * Legend items for the threshold steps of a field: `< 80` for the base step, `80+` for
 * the others. Port of core's `getThresholdItems`:
 * https://github.com/grafana/grafana/blob/main/public/app/core/components/TimelineChart/utils.ts
 */
export function getThresholdItems(fieldConfig: FieldConfig, theme: GrafanaTheme2): VizLegendItem[] {
  const steps = fieldConfig.thresholds?.steps ?? [];
  const getDisplay = getValueFormat(
    fieldConfig.thresholds?.mode === ThresholdsMode.Percentage ? 'percent' : (fieldConfig.unit ?? '')
  );
  // `undefined` decimals use `auto`.
  const format = (value: number) => formattedValueToString(getDisplay(value, fieldConfig.decimals ?? undefined));

  return steps.map((step, i) => {
    const isBase = step.value === -Infinity && i < steps.length - 1;
    const label = isBase ? `< ${format(steps[i + 1].value)}` : `${format(step.value)}+`;
    return { label, color: theme.visualization.getColorByName(step.color), yAxis: 1 };
  });
}

/**
 * The read-only timeline legend, as core builds it (`getFieldLegendItem`):
 *
 * - threshold colour mode with more than one step: one item per step;
 * - continuous colour modes: no items (core plans a colour bar);
 * - else one item per unique state text, with its colour, over all fields that are
 *   not hidden from the legend.
 */
export function getTimelineLegendItems(fields: Field[], theme: GrafanaTheme2): VizLegendItem[] {
  if (fields.length === 0) {
    return [];
  }

  const fieldConfig = fields[0].config;
  const colorMode = fieldConfig.color?.mode ?? FieldColorModeId.Fixed;
  const steps = fieldConfig.thresholds?.steps;

  if (colorMode === FieldColorModeId.Thresholds && steps && steps.length > 1) {
    return getThresholdItems(fieldConfig, theme);
  }
  if (colorMode.startsWith('continuous')) {
    return [];
  }

  const stateColors = new Map<string, string>();
  for (const field of fields) {
    const custom: unknown = field.config.custom;
    const hideFrom: unknown =
      typeof custom === 'object' && custom !== null ? Reflect.get(custom, 'hideFrom') : undefined;
    const hidden = typeof hideFrom === 'object' && hideFrom !== null && Reflect.get(hideFrom, 'legend') === true;
    if (hidden || !field.display) {
      continue;
    }
    for (const value of field.values) {
      const state = field.display(value);
      if (state.color) {
        stateColors.set(state.text, state.color);
      }
    }
  }

  const items: VizLegendItem[] = [];
  stateColors.forEach((color, label) => {
    if (label.length > 0) {
      items.push({ label, color: theme.visualization.getColorByName(color ?? FALLBACK_COLOR), yAxis: 1 });
    }
  });
  return items;
}
