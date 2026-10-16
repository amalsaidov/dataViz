import { type ValueFormatter } from '@grafana/data';
import { type LineInterpolation } from '@grafana/schema';
import { type LineSeriesOption } from 'echarts';
import {
  type CartesianShowValues,
  type CartesianSingleValueSeriesType,
  type CartesianValueLabelPosition,
} from 'editor/types';
import { type PerfSeriesOptions } from 'lib/echarts/performance/types';

/** Built-in color gradients offered for the heatmap cell layer. */
export type HeatmapColorScheme = 'spectral' | 'blues' | 'turbo' | 'magma';

/**
 * Heatmap coordinate model:
 * - `binned`: cells positioned by explicit bounds on continuous axes (Grafana
 *   dataplane heatmap frames: time/numeric X, numeric bucket Y). Drawn as a
 *   custom series of interval rectangles. The default.
 * - `matrix`: a category x category grid (one tile per ordinal slot), drawn by
 *   the native ECharts heatmap series.
 *   https://echarts.apache.org/en/option.html#series-heatmap
 */
export type HeatmapLayout = 'binned' | 'matrix';

/**
 * Where the heatmap color scale (the ECharts `visualMap` legend) is rendered
 * relative to the cell grid.
 */
export type HeatmapColorScalePlacement = 'right' | 'bottom' | 'none';

/** Inputs of {@link getCartesianValueLabel}. */
export interface CartesianValueLabelInput {
  showValues: CartesianShowValues | undefined;
  position: CartesianValueLabelPosition | undefined;
  seriesType: CartesianSingleValueSeriesType;
  /** Label text for each data index. Bar series pass it (see `getBarLabelTexts`). */
  texts?: string[];
  /** The field's Grafana value formatter, for series with no `texts`. */
  formatValue?: ValueFormatter;
  /** Bar label font size (px). `null` hides the labels: the auto size is too small. */
  fontSize?: number | null;
}

/**
 * The data-independent inputs a converter supplies for one cartesian series: its
 * name, positional `data`, resolved color, canvas `zlevel`, (bar-only) stack
 * group and value formatter. `buildCartesianSeries` composes these with the
 * Advanced options.
 */
export interface CartesianSeriesInput {
  name: string;
  data: LineSeriesOption['data'];
  color: string | undefined;
  zlevel: number | undefined;
  stack?: string;
  /** The source field's Grafana value formatter, used by the "Show values" labels. */
  formatValue?: ValueFormatter;
  /** Bar series: the value label text of each point (see `getBarLabelTexts`). */
  labelTexts?: string[];
  /** Bar series: the value label font size (px), or `null` to hide the labels (see `getBarLabelFontSize`). */
  labelFontSize?: number | null;
  /** Bar series: the category and group gaps (see `getBarGaps`). */
  barGaps?: { barCategoryGap: string; barGap: string };
  /**
   * Density-resolved fast-path props from `getSeriesPerfOptions` (symbols off /
   * LTTB for dense lines; `large` for dense scatter/bar). Already narrowed to the
   * series' render type by the resolver, so it is spread as-is.
   */
  perf?: PerfSeriesOptions;
  /**
   * Whether this series participates in tooltip hover: emits `triggerEvent` and,
   * for symbol types, the scaled `HOVER_POINT_EMPHASIS` marker. Set by the
   * time-axis converter, whose tooltip dispatches `highlight` at the focused
   * point. Category-axis charts do not opt in (see `categoryCartesianToEChartsOption`).
   */
  hover?: boolean;
  /** Line series: connect the line over null values (ECharts `connectNulls`). See `spanNulls.ts`. */
  connectNulls?: boolean;
  /** Line series: the line shape (core `custom.lineInterpolation`). See `getLineInterpolation`. */
  lineInterpolation?: LineInterpolation;
  /** Line series: the dash segment lengths in px (ECharts `lineStyle.type`). See `resolveFieldLineDash`. */
  lineDash?: number[];
  /** Line series: draw round segment ends, so a zero-length segment is a dot (ECharts `lineStyle.cap`). */
  lineRoundCap?: boolean;
}
