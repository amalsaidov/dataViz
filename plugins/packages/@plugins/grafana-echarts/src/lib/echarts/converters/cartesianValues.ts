import {
  type DataFrame,
  type Field,
  FieldColorModeId,
  formattedValueToString,
  getDisplayProcessor,
  getFieldDisplayName,
  type GrafanaTheme2,
  type ValueFormatter,
} from '@grafana/data';
import { GraphTransform, StackingMode } from '@grafana/schema';
import { type LineSeriesOption } from 'echarts';
import { type OptionDataValue } from 'echarts/types/src/util/types';
import { getBarRadius } from 'lib/echarts/options/cartesian';
import { connectStackedLines } from 'lib/echarts/converters/stackedLines';
import {
  estimateBarThickness,
  getBarFillColor,
  getBarGaps,
  getBarLabelFontSize,
  getBarValueEndRadius,
  hasPerBarColor,
  resolvePanelStacking,
  toPercentOfTotal,
} from 'lib/echarts/options/bars';
import {
  type CartesianBandLayout,
  type CartesianDataInput,
  type CartesianSeriesSource,
  type CartesianValueSource,
  type ResolvedSeriesValues,
} from 'lib/echarts/converters/types';
import { getFieldConfigFromField } from 'lib/grafana/fields/fieldConfig';
import { type PanelOptions } from 'types';

/**
 * The drawn values, label texts and data items of the cartesian series, shared by
 * the time and the category converter. A drawn value differs from the field
 * value for percent stacking (the share of the stack) and for the "Negative Y"
 * transform. Then each data item carries the field value last, where the tooltip
 * and the value labels read it (see `unwrapEChartsValue`).
 */

/**
 * Drawn values of every source: the `drawnValues` of a stack of lines, the percent of the stack total,
 * then the "Negative Y" transform. Last, the connected points of the stacked lines go on their
 * segments (see `connectStackedLines`).
 */
export function resolveDrawnValues(
  sources: CartesianValueSource[],
  stacking: StackingMode
): Array<Array<number | null>> {
  const drawn = sources.map(({ values, drawnValues }) => drawnValues ?? values);
  const stacks = getStacks(sources);
  if (stacking === StackingMode.Percent) {
    // Each stack has its own total (see `getStacks`).
    for (const stackedIndexes of stacks.values()) {
      const shares = toPercentOfTotal(stackedIndexes.map((index) => drawn[index]));
      stackedIndexes.forEach((index, i) => (drawn[index] = shares[i]));
    }
  }
  const result = drawn.map((values, index) =>
    isNegativeY(sources[index].field) ? values.map((value) => (value == null ? null : -value)) : values
  );
  for (const lines of stacks.values()) {
    const xs = sources[lines[0]]?.xs;
    if (!sources[lines[0]].isBar && xs && lines.some((index) => sources[index].connected)) {
      const connected = connectStackedLines(
        xs,
        lines.map((index) => result[index]),
        lines.map((index) => sources[index].connected ?? [])
      );
      lines.forEach((index, i) => (result[index] = connected[i]));
    }
  }
  return result;
}

/**
 * The indexes of the stacked sources, by stack. A source without a `stackId` is in the one stack of its
 * draw style: bars and lines stack in different groups (see `LINE_STACK_GROUP_ID`).
 */
export function getStacks(sources: CartesianValueSource[]): Map<string, number[]> {
  const stacks = new Map<string, number[]>();
  sources.forEach((source, index) => {
    if (source.stacked) {
      const id = source.stackId ?? (source.isBar ? 'bar' : 'line');
      stacks.set(id, [...(stacks.get(id) ?? []), index]);
    }
  });
  return stacks;
}

/** Core Time series / Bar chart `custom.transform: negative-Y`: the series draws below zero. */
export function isNegativeY(field: Field): boolean {
  return getFieldConfigFromField(field).custom?.transform === GraphTransform.NegativeY;
}

/**
 * Value label text for each point of a bar series. Percent stacking labels the
 * share with the `percentunit` unit, as core `prepConfig`; otherwise the label is
 * the field value with its unit, decimals and value mappings.
 */
export function getBarLabelTexts(
  source: CartesianValueSource,
  drawn: Array<number | null>,
  percent: boolean,
  formatValue: ValueFormatter,
  theme: GrafanaTheme2
): string[] {
  if (percent && source.stacked) {
    const share = getDisplayProcessor({
      field: { ...source.field, config: { ...source.field.config, unit: 'percentunit' } },
      theme,
    });
    return drawn.map((value) => (value == null ? '' : formattedValueToString(share(Math.abs(value)))));
  }
  return source.values.map((value) => (value == null ? '' : formattedValueToString(formatValue(value))));
}

/**
 * Per-bar fill colors, or `undefined` when the series has one color. "Color by
 * field" colors each bar from that field's display color at the same row. A
 * field with thresholds colors each bar from its threshold step; a colored value
 * mapping colors the bars it matches, and the other bars keep the series color.
 * See core `prepConfig` in `public/app/plugins/panel/barchart/utils.ts`.
 */
export function getPerBarColors(
  source: CartesianValueSource & { color: string },
  colorField: Field | undefined,
  rows: Array<number | null>,
  theme: GrafanaTheme2
): Array<string | undefined> | undefined {
  if (!source.isBar) {
    return undefined;
  }
  if (colorField) {
    const display = colorField.display;
    return rows.map((row) => (row == null || !display ? undefined : display(colorField.values[row]).color));
  }
  const { field } = source;
  if (!hasPerBarColor(field) || !field.display) {
    return undefined;
  }
  if (field.config.color?.mode === FieldColorModeId.Thresholds) {
    const display = field.display;
    return source.values.map((value) => (value == null ? undefined : display(value).color));
  }
  // The display color of an unmapped value is the palette color by Grafana's
  // series index, which is off by one per label column (see
  // `getCartesianSeriesColor`). A fixed series color keeps only the mapping colors.
  const display = getDisplayProcessor({
    field: { ...field, config: { ...field.config, color: { mode: FieldColorModeId.Fixed, fixedColor: source.color } } },
    theme,
  });
  return source.values.map((value) => (value == null ? undefined : display(value).color));
}

/** The "Color by field" field in a frame, matched by display name or name, as core `prepSeries`. */
export function findColorByField(
  frame: DataFrame,
  frames: DataFrame[],
  options: Pick<PanelOptions, 'colorByField'>
): Field | undefined {
  const name = options.colorByField;
  if (!name) {
    return undefined;
  }
  return frame.fields.find((field) => getFieldDisplayName(field, frame, frames) === name || field.name === name);
}

/**
 * ECharts data items of one series. With no transform, per-bar color or radius
 * the items are the plain values (category axis) or `[x, value]` pairs (time
 * axis), as before. A transformed point adds the field value as a last dimension.
 * https://echarts.apache.org/en/option.html#series-bar.data
 */
export function buildCartesianData(input: CartesianDataInput): LineSeriesOption['data'] {
  const { xs, drawn, values, horizontal, colors, radius = 0, barFillOpacity } = input;
  const connected = new Set(input.connected);
  return drawn.map((value, i) => {
    const raw = values[i] ?? null;
    const transformed = value !== raw;
    let point: OptionDataValue | OptionDataValue[];
    if (xs) {
      point = transformed ? [xs[i], value, raw] : [xs[i], value];
    } else if (transformed) {
      point = horizontal ? [value, i, raw] : [i, value, raw];
    } else {
      point = value;
    }

    const color = colors?.[i];
    const itemStyle = {
      ...(color ? { color: getBarFillColor(color, barFillOpacity), borderColor: color } : {}),
      ...(radius > 0 && value != null ? { borderRadius: getBarValueEndRadius(radius, value, horizontal) } : {}),
    };
    if (connected.has(i)) {
      return { value: point, symbol: 'none' };
    }
    return Object.keys(itemStyle).length > 0 ? { value: point, itemStyle } : point;
  });
}

/**
 * Data, value labels and bar spacing of every series, as core Bar chart. Percent
 * stacking and "Negative Y" set the drawn values; the last stacked bar and the
 * unstacked bars get the value-end corner radius; the value label size fits the
 * estimated bar thickness.
 */
export function resolveSeriesValues(
  sources: CartesianSeriesSource[],
  layout: CartesianBandLayout,
  options: PanelOptions,
  theme: GrafanaTheme2
): ResolvedSeriesValues[] {
  const stacking = resolvePanelStacking(options);
  const percent = stacking === StackingMode.Percent;
  const drawn = resolveDrawnValues(sources, stacking);
  // The last bar of each bar stack gets the value-end corners. Each bar stack takes one slot.
  const barStacks = [...getStacks(sources).values()].filter((indexes) => sources[indexes[0]].isBar);
  const topStacked = new Set(barStacks.map((indexes) => indexes[indexes.length - 1]));
  const slots = sources.filter((source) => source.isBar && !source.stacked).length + barStacks.length;

  const labelTexts = sources.map((source, i) =>
    source.isBar ? getBarLabelTexts(source, drawn[i], percent, source.formatValue, theme) : undefined
  );
  const thickness = estimateBarThickness(layout.plotLength ?? 0, layout.bandCount, slots);
  const barTexts = labelTexts.flatMap((texts) => texts ?? []).filter((text) => text !== '');
  const labelFontSize =
    layout.plotLength == null && options.text?.valueSize == null
      ? undefined
      : getBarLabelFontSize(barTexts, thickness, layout.horizontal, options.text?.valueSize);
  const radius = getBarRadius(options.barRadius) ?? 0;

  return sources.map((source, i) => {
    const data = buildCartesianData({
      xs: source.xs,
      drawn: drawn[i],
      values: source.values,
      horizontal: layout.horizontal,
      colors: getPerBarColors(source, source.colorField, source.rows, theme),
      radius: source.isBar && (!source.stacked || topStacked.has(i)) ? radius : 0,
      barFillOpacity: options.barFillOpacity,
      connected: source.connected,
    });
    if (!source.isBar) {
      return { data };
    }
    return { data, labelTexts: labelTexts[i], labelFontSize, barGaps: getBarGaps(slots) };
  });
}
