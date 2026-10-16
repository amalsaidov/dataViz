import { colorManipulator, type Field, FieldColorModeId, type ValueMapping } from '@grafana/data';
import { StackingMode, VizOrientation } from '@grafana/schema';
import { calculateFontSize } from '@grafana/ui';
import {
  CARTESIAN_BAR_BORDER_WIDTH_DEFAULT,
  CARTESIAN_BAR_FILL_OPACITY_DEFAULT,
  CARTESIAN_GROUP_WIDTH,
  CARTESIAN_SLOT_WIDTH,
} from 'editor/cartesian';
import { type PanelOptions } from 'types';

/**
 * Bar-only rules of core Grafana's Bar chart panel, ported to ECharts options:
 * stacking mode, orientation, bar spacing, fill and border, value-end corners,
 * per-bar colors and the value label size. Core source:
 * https://github.com/grafana/grafana/tree/main/public/app/plugins/panel/barchart
 */

/** Smallest value label font (px). Core hides the labels below it (`VALUE_MIN_FONT_SIZE`). */
export const BAR_LABEL_MIN_FONT_SIZE = 8;
/**
 * Largest auto value label font (px). Core allows 30 px, but it also fits the
 * label in the space above the tallest bar, which ECharts only knows after
 * layout. The grid keeps one label row above the bars instead, of this size.
 */
export const BAR_LABEL_MAX_FONT_SIZE = 14;
/** Share of the bar thickness a label may fill, core `BAR_FONT_SIZE_RATIO`. */
const BAR_FONT_SIZE_RATIO = 0.65;

/**
 * The panel stacking mode. `stacking` wins; a legacy `stackSeries: true` reads
 * as `normal`, so panels saved before the Stacking option keep their stacks.
 */
export function resolvePanelStacking(options: Pick<PanelOptions, 'stacking' | 'stackSeries'>): StackingMode {
  if (options.stacking != null) {
    return options.stacking;
  }
  return options.stackSeries ? StackingMode.Normal : StackingMode.None;
}

/**
 * True when bars draw horizontally. `auto` is horizontal when the plot is taller
 * than it is wide, as core `BarChartPanel`. Only a category x-axis can turn: the
 * time axis stays horizontal, as in core Time series.
 */
export function isHorizontalBars(
  orientation: VizOrientation | undefined,
  isCategoryAxis: boolean,
  plotWidth: number | undefined,
  plotHeight: number | undefined
): boolean {
  if (!isCategoryAxis) {
    return false;
  }
  if (orientation === VizOrientation.Horizontal) {
    return true;
  }
  if (orientation === VizOrientation.Vertical) {
    return false;
  }
  return plotWidth != null && plotHeight != null && plotWidth < plotHeight;
}

/**
 * ECharts bar spacing for core's default group and bar widths. One bar (or one
 * stack) per category fills 97% of it; a group of bars fills 70%, and each bar
 * fills 97% of its slot in the group.
 * https://echarts.apache.org/en/option.html#series-bar.barCategoryGap
 * https://echarts.apache.org/en/option.html#series-bar.barGap
 */
export function getBarGaps(slotsPerCategory: number): { barCategoryGap: string; barGap: string } {
  const groupWidth = slotsPerCategory > 1 ? CARTESIAN_GROUP_WIDTH : CARTESIAN_SLOT_WIDTH;
  const barGap = (1 - CARTESIAN_SLOT_WIDTH) / CARTESIAN_SLOT_WIDTH;
  return { barCategoryGap: toPercent(1 - groupWidth), barGap: toPercent(barGap) };
}

/**
 * ECharts bar spacing for core Time series: each bar fills 97% of its band, and
 * the bars of different series at the same x draw on top of each other.
 * https://echarts.apache.org/en/option.html#series-bar.barGap
 */
export function getOverlapBarGaps(): { barCategoryGap: string; barGap: string } {
  return { barCategoryGap: toPercent(1 - CARTESIAN_SLOT_WIDTH), barGap: '-100%' };
}

function toPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

/**
 * Bar fill and border, as core: the fill is the series color at the fill
 * opacity (default 80%), and the border is the solid color at the line width
 * (default 1 px). `color` is the fallback fill for data items with no own color.
 * https://echarts.apache.org/en/option.html#series-bar.itemStyle
 */
export function getBarItemStyle(
  color: string | undefined,
  options: Pick<PanelOptions, 'barFillOpacity' | 'lineWidth'>
): { color?: string; borderColor?: string; borderWidth: number } {
  const borderWidth = options.lineWidth ?? CARTESIAN_BAR_BORDER_WIDTH_DEFAULT;
  return {
    ...(color ? { color: getBarFillColor(color, options.barFillOpacity), borderColor: color } : {}),
    borderWidth,
  };
}

/** A bar color at the fill opacity (0 to 100, default 80). */
export function getBarFillColor(color: string, fillOpacity: number | undefined): string {
  const opacity = Math.min(Math.max(fillOpacity ?? CARTESIAN_BAR_FILL_OPACITY_DEFAULT, 0), 100) / 100;
  return colorManipulator.alpha(color, opacity);
}

/**
 * Round only the value end of a bar, as core: the top of a positive vertical
 * bar, the bottom of a negative one, and the right or left end of a horizontal
 * one. ECharts orders the corners top-left, top-right, bottom-right, bottom-left.
 * https://echarts.apache.org/en/option.html#series-bar.itemStyle.borderRadius
 */
export function getBarValueEndRadius(radius: number, value: number, horizontal: boolean): number[] {
  const negative = value < 0;
  if (horizontal) {
    return negative ? [radius, 0, 0, radius] : [0, radius, radius, 0];
  }
  return negative ? [0, 0, radius, radius] : [radius, radius, 0, 0];
}

/**
 * True when a field colors each bar from its value, as core `prepConfig`: the
 * color scheme is "From thresholds", or a value mapping sets a color.
 */
export function hasPerBarColor(field: Field): boolean {
  if (field.config.color?.mode === FieldColorModeId.Thresholds) {
    return true;
  }
  return (field.config.mappings ?? []).some(mappingSetsColor);
}

function mappingSetsColor(mapping: ValueMapping): boolean {
  if (mapping.type === 'value') {
    return Object.values(mapping.options).some((result) => result.color != null);
  }
  return mapping.options.result.color != null;
}

/**
 * Stacked values as a share of their stack total, for percent stacking. Each
 * index sums the absolute values of every stacked series, so each stack fills
 * the axis from 0 to 1 (0% to 100%).
 */
export function toPercentOfTotal(stacked: Array<Array<number | null>>): Array<Array<number | null>> {
  const length = Math.max(0, ...stacked.map((values) => values.length));
  const totals = Array.from({ length }, (_, i) => stacked.reduce((sum, values) => sum + Math.abs(values[i] ?? 0), 0));
  return stacked.map((values) =>
    values.map((value, i) => (value == null ? null : totals[i] === 0 ? 0 : value / totals[i]))
  );
}

/**
 * Estimated thickness (px) of one bar, from the plot length along the category
 * axis, the number of bands on it and the bar slots in each band. Used only to
 * size the value labels and to space the x tick labels, as core does from the
 * drawn bar geometry.
 */
export function estimateBarThickness(plotLength: number, bandCount: number, slotsPerBand: number): number {
  if (bandCount <= 0 || plotLength <= 0) {
    return 0;
  }
  const groupWidth = slotsPerBand > 1 ? CARTESIAN_GROUP_WIDTH : CARTESIAN_SLOT_WIDTH;
  return ((plotLength / bandCount) * groupWidth * CARTESIAN_SLOT_WIDTH) / Math.max(1, slotsPerBand);
}

/**
 * Font size (px) of the bar value labels. `valueSize` (the "Text size > Value"
 * option) wins. Otherwise the largest text fits in 65% of the bar thickness, as
 * core `bars.ts`, up to {@link BAR_LABEL_MAX_FONT_SIZE}. Returns `null` when the
 * auto size is under 8 px: core then draws no value labels.
 */
export function getBarLabelFontSize(
  texts: string[],
  thickness: number,
  horizontal: boolean,
  valueSize: number | undefined
): number | null {
  if (valueSize != null && valueSize > 0) {
    return valueSize;
  }
  let fontSize = BAR_LABEL_MAX_FONT_SIZE;
  for (const text of texts) {
    // A vertical bar limits the label width; a horizontal bar limits its height.
    const width = horizontal ? Number.MAX_SAFE_INTEGER : thickness * BAR_FONT_SIZE_RATIO;
    const height = horizontal ? thickness * BAR_FONT_SIZE_RATIO : Number.MAX_SAFE_INTEGER;
    fontSize = Math.min(fontSize, calculateFontSize(text, width, height, 1, BAR_LABEL_MAX_FONT_SIZE));
  }
  const rounded = Math.round(fontSize);
  return rounded < BAR_LABEL_MIN_FONT_SIZE ? null : rounded;
}
