import { LineInterpolation } from '@grafana/schema';
import { formattedValueToString, type GrafanaTheme2, type TimeRange, type ValueFormatter } from '@grafana/data';
import {
  type BarSeriesOption,
  type EffectScatterSeriesOption,
  type LineSeriesOption,
  type ScatterSeriesOption,
} from 'echarts';
import { type CallbackDataParams, type ECBasicOption } from 'echarts/types/dist/shared';
import { type AxisLabelValueFormatter, type TimeAxisBaseOption } from 'echarts/types/src/coord/axisCommonTypes';
import {
  type CartesianAxisOption,
  type XAXisOption,
  type YAXisOption,
} from 'echarts/types/src/coord/cartesian/AxisModel';
import { CARTESIAN_ANIMATION_ENABLED_DEFAULT, CARTESIAN_VALUE_LABEL_POSITION_DEFAULT } from 'editor/cartesian';
import { type CartesianSingleValueSeriesType } from 'editor/types';
import { AXIS_FONT_SIZE, createBaseOptions, getUPlotGridColor } from 'lib/echarts/options/base';
import { applyAdvancedDefaults } from 'lib/echarts/options/editorMode';
import { getBarItemStyle } from 'lib/echarts/options/bars';
import { getThemedLabelStyle } from 'lib/echarts/options/labels';
import { type CartesianSeriesInput, type CartesianValueLabelInput } from 'lib/echarts/options/types';
import { type PerfSeriesOptions } from 'lib/echarts/performance/types';
import { formatEChartsValue } from 'lib/echarts/style';
import { type PanelOptions } from 'types';

/**
 * Pin an ECharts `time` axis to the dashboard time range so panels with gappy
 * data still span the full window and line up with sibling panels in the
 * dashboard. Bounds are epoch milliseconds, which is what a `time` axis expects.
 * https://echarts.apache.org/en/option.html#xAxis.min
 */
export function getTimeAxisBounds(timeRange: TimeRange): { min: number; max: number } {
  return { min: timeRange.from.valueOf(), max: timeRange.to.valueOf() };
}

/**
 * Axis + grid styling that mirrors Core Grafana's uPlot time series panels.
 */
export function getCartesianAxisStyle(theme: GrafanaTheme2) {
  const gridColor = getUPlotGridColor(theme);

  return {
    axisLine: { show: false },
    axisTick: { show: true, length: 4, lineStyle: { color: gridColor } },
    axisLabel: {
      color: theme.colors.text.primary,
      fontFamily: theme.typography.fontFamily,
      fontSize: AXIS_FONT_SIZE,
    },
    splitLine: { show: true, lineStyle: { color: gridColor } },
  };
}

/**
 * Merge base axis config with theme styling and optional extras.
 *
 * Generic over the concrete axis type (`XAXisOption`/`YAXisOption`) so the merged
 * result keeps the discriminated ECharts axis type of the `baseAxis`, letting it
 * assign directly to a composed option's `xAxis`/`yAxis` without a cast.
 */
export function mergeAxisStyle<T extends CartesianAxisOption>(
  baseAxis: T,
  axisStyle: CartesianAxisOption | TimeAxisBaseOption,
  extras?: CartesianAxisOption | TimeAxisBaseOption,
  grafanaValueFormatter?: ValueFormatter
): T {
  const extraAxisLabel = extras?.axisLabel ?? {};
  const extraAxisTick = extras?.axisTick ?? {};
  const extraSplitLine = extras?.splitLine ?? {};

  // Only attach a formatter when a Grafana value formatter is supplied. Axes
  // without one (e.g. the time x-axis) must keep ECharts' default formatter
  // https://echarts.apache.org/en/option.html#yAxis.axisLabel.formatter
  const formatter: AxisLabelValueFormatter | undefined = grafanaValueFormatter
    ? (value) => formattedValueToString(grafanaValueFormatter(value))
    : undefined;

  return {
    ...baseAxis,
    ...axisStyle,
    ...extras,
    axisLabel: {
      ...axisStyle.axisLabel,
      ...extraAxisLabel,
      ...(formatter ? { formatter } : {}),
    },
    axisTick: { ...axisStyle.axisTick, ...extraAxisTick },
    splitLine: { ...axisStyle.splitLine, ...extraSplitLine },
  };
}

/**
 * Shared base option for cartesian time series charts (line, bar, scatter).
 * Tooltip and grid are merged at render time.
 */
export const cartesianTimeDefaultOptions: ECBasicOption & { xAxis: XAXisOption; yAxis: YAXisOption } = {
  ...createBaseOptions(),
  xAxis: {
    type: 'time',
    tooltip: { show: true },
    alignTicks: true,
  },
  yAxis: {
    type: 'value',
    // `scale: true` auto-fits the axis to the data's min/max
    // https://echarts.apache.org/en/option.html#yAxis.scale
    scale: true,
  },
};

/**
 * Shared base option for category-axis cartesian charts (Group 2: category
 * bar/line built from Numeric frames). Same value y-axis as the time variant,
 * but the x-axis is `category` and its labels (`data`) are supplied at render
 * time from the categorical model. Tooltip and grid are merged at render time.
 * See https://echarts.apache.org/en/option.html#xAxis.type
 */
export const cartesianCategoryDefaultOptions: ECBasicOption & { xAxis: XAXisOption; yAxis: YAXisOption } = {
  ...createBaseOptions(),
  xAxis: {
    type: 'category',
  },
  yAxis: {
    type: 'value',
    // See cartesianTimeDefaultOptions above: fit to data min/max, don't force zero.
    // https://echarts.apache.org/en/option.html#yAxis.scale
    scale: true,
  },
};

/* --- Categorical multi-axis parity uplift: series-level ECharts option builders
 * Each helper follows pie's "omit-at-default" convention: it returns `undefined`
 * / `{}` at the default so an untouched panel's series are byte-for-byte the same
 * as before, and only opted-in options add ECharts keys. */

/**
 * ECharts series `label` for the cartesian "Show values" option, as core Bar
 * chart. `always` labels every series. `auto` (the editor default) labels bar
 * series only; the series adds `labelLayout.hideOverlap` so labels that overlap
 * are hidden. `never` draws no labels, and nor does an unset option: the heatmap
 * overlay reuses these series and has no "Show values" option.
 *
 * The text is the field value with its unit, decimals and value mappings (or the
 * precomputed `texts`), not the raw number. `buildCartesianSeries` moves a bar
 * label at `top` to the ECharts `outside` position, which is the same for a
 * positive bar and flips below the end of a negative bar, as core does.
 * https://echarts.apache.org/en/option.html#series-bar.label
 * https://echarts.apache.org/en/option.html#series-bar.label.formatter
 */
export function getCartesianValueLabel(input: CartesianValueLabelInput, theme: GrafanaTheme2) {
  const { showValues, position, seriesType, texts, formatValue, fontSize } = input;
  const isBar = seriesType === 'bar';
  if (showValues == null || showValues === 'never' || (showValues === 'auto' && !isBar) || fontSize === null) {
    return undefined;
  }
  const resolvedPosition = position ?? CARTESIAN_VALUE_LABEL_POSITION_DEFAULT;
  const formatter = texts
    ? (params: CallbackDataParams) => texts[params.dataIndex] ?? ''
    : formatValue
      ? (params: CallbackDataParams) => formatEChartsValue(params.value, formatValue)
      : undefined;
  // Return the inferred structural label (not a series-specific `label` type):
  // the concrete per-series label types differ (bar accepts `outside`), so a
  // shared structural object assigns to bar and line alike.
  return {
    ...getThemedLabelStyle(theme, { fontSize: fontSize ?? undefined }),
    show: true,
    position: resolvedPosition,
    ...(formatter ? { formatter } : {}),
  };
}

/**
 * ECharts bar `series.barWidth` from the "Bar width" percentage. `undefined` / 0
 * returns `undefined` so ECharts' auto width stands. Bar series only.
 * https://echarts.apache.org/en/option.html#series-bar.barWidth
 */
export function getBarWidth(barWidth: number | undefined): string | undefined {
  return barWidth != null && barWidth > 0 ? `${barWidth}%` : undefined;
}

/**
 * Bar corner radius (px) from "Bar corner radius". 0/unset returns `undefined`
 * (square corners; key omitted).
 * https://echarts.apache.org/en/option.html#series-bar.itemStyle.borderRadius
 */
export function getBarRadius(barRadius: number | undefined): number | undefined {
  return barRadius != null && barRadius > 0 ? barRadius : undefined;
}

/**
 * Per-series `lineStyle` composing the series color with the "Line width" and the "Line style". The
 * `width` is omitted at unset/≤0 so ECharts' default stroke stands. Line series.
 * A dash array is in px and does not scale with the width, as the uPlot `dash` of core.
 * https://echarts.apache.org/en/option.html#series-line.lineStyle.width
 * https://echarts.apache.org/en/option.html#series-line.lineStyle.type
 * https://echarts.apache.org/en/option.html#series-line.lineStyle.cap
 */
export function getCartesianLineStyle(
  color: string | undefined,
  lineWidth: number | undefined,
  lineDash?: number[],
  lineRoundCap?: boolean
): LineSeriesOption['lineStyle'] {
  return {
    color,
    ...(lineWidth != null && lineWidth > 0 ? { width: lineWidth } : {}),
    ...(lineDash ? { type: lineDash } : {}),
    ...(lineRoundCap ? { cap: 'round' as const } : {}),
  };
}

/**
 * ECharts line `series.areaStyle` from "Fill opacity" (0–100 → 0–1). A non-zero
 * value turns a line into an area chart; 0/unset returns `undefined` (a plain
 * line). Line series only.
 * https://echarts.apache.org/en/option.html#series-line.areaStyle
 */
export function getCartesianAreaStyle(fillOpacity: number | undefined): LineSeriesOption['areaStyle'] | undefined {
  return fillOpacity != null && fillOpacity > 0 ? { opacity: Math.min(fillOpacity, 100) / 100 } : undefined;
}

/**
 * ECharts symbol keys from "Point size": `0` hides the points
 * (`showSymbol: false`), a positive value sets `symbolSize`, and unset returns
 * `{}` (ECharts' default symbol). line/scatter series.
 * https://echarts.apache.org/en/option.html#series-line.symbolSize
 */
export function getCartesianSymbol(pointSize: number | undefined): { symbolSize?: number; showSymbol?: boolean } {
  if (pointSize == null) {
    return {};
  }
  return pointSize <= 0 ? { showSymbol: false } : { symbolSize: pointSize };
}

/**
 * ECharts `xAxis.axisLabel.rotate` extra from "X tick rotation". 0/unset returns
 * `{}` so labels stay horizontal (unchanged).
 * https://echarts.apache.org/en/option.html#xAxis.axisLabel.rotate
 */
export function getXTickRotate(xTickRotate: number | undefined): { rotate?: number } {
  return xTickRotate != null && xTickRotate !== 0 ? { rotate: xTickRotate } : {};
}

/** A single cartesian series entry (one render type per member of the union). */
export type CartesianSeriesEntry = BarSeriesOption | LineSeriesOption | ScatterSeriesOption | EffectScatterSeriesOption;

/**
 * Emphasis (hover) state for a datapoint, applied by the tooltip's `highlight`
 * dispatch to mark the focused point — core Grafana's hover marker.
 *
 * `scale` enlarges the symbol relative to the series' `symbolSize` (6px by
 * default), which is what makes the point read as focused; for a dense line
 * whose symbols aren't rendered, ECharts creates one on demand to carry this
 * state. `focus: 'none'` keeps the other series at full opacity — ECharts would
 * otherwise dim them, which core does not do.
 *
 * The symbol inherits the series' `itemStyle.color`, so no colour is set here.
 * Bars have no symbol to scale (and `scale` is not part of their emphasis
 * options), so they keep ECharts' default emphasis; their hit area is already
 * large enough not to need a marker.
 * https://echarts.apache.org/en/option.html#series-line.emphasis
 */
export const HOVER_POINT_EMPHASIS = {
  focus: 'none',
  scale: 2,
} as const;

/** Series types drawn with a symbol, so a scaled emphasis marker applies. */
export function isSymbolSeriesType(type: string | undefined): type is 'line' | 'scatter' | 'effectScatter' {
  return type === 'line' || type === 'scatter' || type === 'effectScatter';
}

/**
 * Compose the "Point size" symbol keys with the Performance layer's
 * density-resolved `showSymbol`.
 *
 * The two options own different halves of the same ECharts surface: Point size
 * sets the marker *size*, while Performance "Show points" decides *visibility* —
 * hiding markers once a chart crosses the total-points threshold, and sparing a
 * series that draws no line and would otherwise render as nothing (see
 * `resolveShowSymbol`). So the size is kept and visibility normally comes from
 * the performance layer.
 *
 * They only disagree when Point size is explicitly `0`, which is itself a direct
 * "no markers" request; it wins, and the density answer is dropped. That matches
 * how the performance layer treats its own explicit modes — Always/Never are
 * obeyed literally, and only the Auto heuristic promises to keep data visible.
 */
function resolveCartesianSymbol(
  pointSize: number | undefined,
  perf: PerfSeriesOptions | undefined
): { symbolSize?: number; showSymbol?: boolean } {
  const symbol = getCartesianSymbol(pointSize);
  if (symbol.showSymbol === false) {
    return symbol;
  }
  return { ...symbol, ...(perf?.showSymbol != null ? { showSymbol: perf.showSymbol } : {}) };
}

/**
 * The ECharts line shape of core `custom.lineInterpolation`. Linear adds no key.
 * - `smooth`: core draws a monotone cubic spline (uPlot `paths.spline`), with no overshoot past a point. ECharts
 *   `smooth: true` with `smoothMonotone: 'x'` is the closest curve: it keeps each segment monotone along x.
 * - `stepBefore` / `stepAfter`: the line steps at the start or at the end of a segment (uPlot `paths.stepped`
 *   `align` -1 / 1), which is ECharts `step: 'start'` / `'end'`.
 * Core: https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/#line-interpolation
 * uPlot: https://github.com/leeoniya/uPlot/blob/master/src/paths/spline.js
 * ECharts: https://echarts.apache.org/en/option.html#series-line.smooth
 * https://echarts.apache.org/en/option.html#series-line.step
 */
export function getLineInterpolation(
  lineInterpolation: LineInterpolation | undefined
): Pick<LineSeriesOption, 'smooth' | 'smoothMonotone' | 'step'> {
  switch (lineInterpolation) {
    case LineInterpolation.Smooth:
      return { smooth: true, smoothMonotone: 'x' };
    case LineInterpolation.StepBefore:
      return { step: 'start' };
    case LineInterpolation.StepAfter:
      return { step: 'end' };
    default:
      return {};
  }
}

/**
 * Build one cartesian series with its value-label / geometry / style
 * options, dispatching on the resolved render type. Each branch returns a
 * concrete series literal with a literal `type`, so the result assigns to
 * ECharts' discriminated `series` union with no cast (a shared object carrying
 * `barWidth` *and* `areaStyle` could not). Every style key is omitted at its
 * default (see the per-option builders), so an untouched panel emits exactly the
 * color-only series it did before. Shared by both cartesian converters.
 */
export function buildCartesianSeries(
  input: CartesianSeriesInput,
  resolvedType: CartesianSingleValueSeriesType,
  options: PanelOptions,
  theme: GrafanaTheme2
): CartesianSeriesEntry {
  const {
    name,
    data,
    color,
    zlevel,
    stack,
    formatValue,
    labelTexts,
    labelFontSize,
    barGaps,
    perf,
    hover,
    connectNulls,
    lineInterpolation,
    lineDash,
    lineRoundCap,
  } = input;
  const label = getCartesianValueLabel(
    {
      showValues: options.showValues,
      position: options.valueLabelPosition,
      seriesType: resolvedType,
      texts: labelTexts,
      formatValue,
      fontSize: labelFontSize,
    },
    theme
  );
  const symbol = resolveCartesianSymbol(options.pointSize, perf);
  // Common (non-discriminating) props every branch shares. `perf` is already
  // narrowed to this series' render type by `getSeriesPerfOptions`, so spreading
  // it whole never writes a key the branch's series type rejects.
  const common = {
    name,
    data,
    zlevel,
    ...(stack ? { stack } : {}),
    ...(label ? { label } : {}),
    ...(hover ? { triggerEvent: true } : {}),
    ...perf,
  };
  // Symbol types carry the scaled hover marker the tooltip's `highlight` dispatch
  // drives; bars have no symbol to scale.
  const emphasis = hover && isSymbolSeriesType(resolvedType) ? { emphasis: HOVER_POINT_EMPHASIS } : {};
  const barWidth = getBarWidth(options.barWidth);

  switch (resolvedType) {
    case 'bar':
      // Bars have no `lineStyle`: the fill and border ride on `itemStyle`. The
      // value-end corner radius and per-bar colors are set on each data item.
      // "Show values: Auto" hides the labels that overlap, as core.
      // https://echarts.apache.org/en/option.html#series-bar.labelLayout
      return {
        ...common,
        type: 'bar',
        itemStyle: getBarItemStyle(color, options),
        ...(label?.position === 'top' ? { label: { ...label, position: 'outside' } } : {}),
        ...barGaps,
        ...(barWidth ? { barWidth } : {}),
        ...(label && options.showValues !== 'always' ? { labelLayout: { hideOverlap: true } } : {}),
      };
    case 'line': {
      const areaStyle = getCartesianAreaStyle(options.fillOpacity);
      return {
        ...common,
        type: 'line',
        itemStyle: { color },
        lineStyle: getCartesianLineStyle(color, options.lineWidth, lineDash, lineRoundCap),
        ...(areaStyle ? { areaStyle } : {}),
        // https://echarts.apache.org/en/option.html#series-line.connectNulls
        ...(connectNulls ? { connectNulls } : {}),
        ...getLineInterpolation(lineInterpolation),
        ...symbol,
        ...emphasis,
      };
    }
    case 'scatter':
      return { ...common, type: 'scatter', itemStyle: { color }, ...symbol, ...emphasis };
    case 'effectScatter':
      return {
        ...common,
        type: 'effectScatter',
        itemStyle: { color },
        showEffectOn: 'emphasis',
        ...symbol,
        ...emphasis,
      };
  }
}

/**
 * Default values for every Advanced-gated cartesian option, keyed by its
 * `PanelOptions` path. Spread over the stored options in Default editor mode (see
 * `applyCartesianEditorModeDefaults`) so a panel with Advanced values configured
 * and then hidden renders exactly like an untouched cartesian panel. Options with
 * core parity, or with a core mapping in `modules/cartesian/compat/` (#130), are
 * Default tier and are not in this set (#404). `animation` is the shared
 * `@internal animation.enabled`. Mirrors `ADVANCED_PIE_DEFAULTS`.
 */
export const ADVANCED_CARTESIAN_DEFAULTS: Partial<PanelOptions> = {
  valueLabelPosition: CARTESIAN_VALUE_LABEL_POSITION_DEFAULT,
  animation: { enabled: CARTESIAN_ANIMATION_ENABLED_DEFAULT },
};

/**
 * Normalize a cartesian panel's options for rendering by editor mode: Default
 * mode spreads `ADVANCED_CARTESIAN_DEFAULTS` over them so hidden Advanced values
 * don't affect the render; Advanced / API mode passes them through. Registered in
 * the `editorMode.ts` dispatch for every cartesian render type.
 */
export function applyCartesianEditorModeDefaults(options: PanelOptions): PanelOptions {
  return applyAdvancedDefaults(options, ADVANCED_CARTESIAN_DEFAULTS);
}
