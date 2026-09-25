import { type DisplayProcessor, formattedValueToString, getValueFormat, type GrafanaTheme2 } from '@grafana/data';
import { type CustomSeriesOption, type CustomSeriesRenderItem } from 'echarts';
import { type ContinuousVisualMapOption } from 'echarts/types/dist/shared';
import type { TimeAxisBaseOption } from 'echarts/types/src/coord/axisCommonTypes';
import type { CartesianAxisOption } from 'echarts/types/src/coord/cartesian/AxisModel';
import { type ZRRectLike } from 'echarts/types/src/util/types';
import {
  type BinnedHeatmapCell,
  type BinnedHeatmapData,
  formatBucketBound,
} from 'lib/echarts/converters/binnedHeatmap';
import { HEATMAP_VALUE_DIM } from 'lib/echarts/options/constants';
import { getHeatmapVisualMap } from 'lib/echarts/options/heatmapVisualMap';
import { isRect } from 'lib/echarts/options/narrowing';
import { type HeatmapColorScalePlacement, type HeatmapColorScheme } from 'lib/echarts/options/types';
import { buildBinnedHeatmapTooltipModel } from 'lib/echarts/tooltip/binnedHeatmap';
import { seriesTooltip } from 'lib/echarts/tooltip/option';
import { type BinnedHeatmapTooltipContext } from 'lib/echarts/tooltip/types';
import { type CoreHeatmapOptions } from 'types';

/**
 * Custom tick/label/grid-line placement for the heatmap bucket (Y) axis so the
 * axis reads as discrete buckets rather than an evenly-spaced numeric scale.
 *
 * ECharts auto-picks "nice" numeric ticks on a value axis (e.g. 0, 5, 10, ...),
 * which land between bucket bounds. Instead we pin:
 * - split lines to every bucket boundary (so each row is fenced off), and
 * - labels to each bucket's upper edge (`le`/numeric bounds) or midpoint
 *   (ordinal rows labelled by name), formatted from the bucket's own label.
 *
 * Uses ECharts `customValues` (value-axis support added in 5.5), so it requires
 * ECharts >= 5.5 (the plugin ships 6.x).
 */
export function getBinnedHeatmapBucketAxis(
  data: BinnedHeatmapData,
  formatLabel: (label: string) => string = (label) => label
): CartesianAxisOption | TimeAxisBaseOption {
  const rawBuckets = data.yBuckets;
  if (rawBuckets.length === 0) {
    return {};
  }

  const labelByValue = new Map<number, string>();
  if (data.yLabelPlacement === 'center') {
    for (const bucket of rawBuckets) {
      labelByValue.set((bucket.start + bucket.end) / 2, bucket.label);
    }
  } else {
    // Label the bottom edge of the first bucket too, so the axis isn't missing
    // its lower bound (e.g. the leading "0" of a Prometheus histogram).
    labelByValue.set(rawBuckets[0].start, formatBucketBound(rawBuckets[0].start));
    for (const bucket of rawBuckets) {
      labelByValue.set(bucket.end, bucket.label);
    }
  }

  const labelValues = Array.from(labelByValue.keys()).sort((a, b) => a - b);
  const labels = labelValues.map((value) => formatLabel(labelByValue.get(value) ?? ''));
  const widest = labels.reduce((a, b) => (b.length > a.length ? b : a), '');

  return {
    axisLabel: {
      customValues: labelValues,
      // Only `customValues` are drawn. `grid.containLabel` measures the axis
      // with its default ticks instead, so those get the widest label to
      // reserve enough room.
      formatter: (value: number) => {
        const label = labelByValue.get(Number(value));
        return label == null ? widest : formatLabel(label);
      },
    },
    axisTick: { customValues: labelValues },
    breaks: rawBuckets,
  };
}

/** Parse a core axis bound, which dashboards store as a number or a string. */
function parseBound(value: number | string | undefined): number | undefined {
  if (value == null || value === '') {
    return undefined;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : undefined;
}

/**
 * The Y axis of the cell layer, from the data's Y scale and core's `yAxis`
 * options (unit, decimals, min, max, reverse).
 *
 * - `buckets`: one label per bucket bound (see {@link getBinnedHeatmapBucketAxis}).
 *   Numeric labels take the unit.
 * - `linear` / `log`: a plain value or log axis with auto ticks, as for the
 *   many uniform buckets of a calculated heatmap.
 *
 * See https://echarts.apache.org/en/option.html#yAxis.type and
 * https://echarts.apache.org/en/option.html#yAxis.inverse
 */
export function getBinnedHeatmapYAxis(
  data: BinnedHeatmapData,
  yAxis: CoreHeatmapOptions['yAxis']
): CartesianAxisOption | TimeAxisBaseOption {
  const unit = yAxis?.unit;
  const decimals = yAxis?.decimals;
  const format = getValueFormat(unit || 'short');
  const formatNumber = (value: number) => formattedValueToString(format(value, decimals));
  const inverse = yAxis?.reverse === true;
  // Only set bounds replace the data range.
  const explicit: { min?: number; max?: number } = {};
  const min = parseBound(yAxis?.min);
  const max = parseBound(yAxis?.max);
  if (min != null) {
    explicit.min = min;
  }
  if (max != null) {
    explicit.max = max;
  }
  const axisLabel = { formatter: (value: number) => formatNumber(value) };

  // A linear scale takes ECharts' auto range unless set, like core's uPlot
  // scale; `undefined` replaces the data range the caller sets. A log range
  // snaps out to whole magnitudes of the set or data range, as in core.
  const scale = data.yScale;
  if (scale?.type === 'log') {
    const log = (value: number) => Math.log(value) / Math.log(scale.log);
    const lo = explicit.min ?? data.yMin;
    const hi = explicit.max ?? data.yMax;
    return {
      type: 'log',
      logBase: scale.log,
      inverse,
      axisLabel,
      min: lo > 0 ? scale.log ** Math.floor(log(lo)) : undefined,
      max: hi > 0 ? scale.log ** Math.ceil(log(hi)) : undefined,
    };
  }
  if (scale?.type === 'linear') {
    return { type: 'value', inverse, axisLabel, min: explicit.min, max: explicit.max };
  }

  const formatLabel =
    unit || decimals != null
      ? (label: string) => {
          const num = Number(label);
          return label !== '' && Number.isFinite(num) ? formatNumber(num) : label;
        }
      : undefined;
  return { ...getBinnedHeatmapBucketAxis(data, formatLabel), inverse, ...explicit };
}

/**
 * Encode cells as `[xStart, yStart, xEnd, yEnd, value]` tuples. The custom
 * series `renderItem` reads the two corners to size each rect; the value dim
 * ({@link HEATMAP_VALUE_DIM}) is what the visualMap maps to a color. ECharts
 * passes this same tuple back as the tooltip hover param's `value`.
 * See https://echarts.apache.org/en/option.html#series-custom.data
 */
export function encodeBinnedHeatmapData(cells: BinnedHeatmapCell[]): Array<Array<number | null>> {
  return cells.map((cell) => [cell.xStart, cell.yStart, cell.xEnd, cell.yEnd, cell.value]);
}

/**
 * Intersect two rectangles, returning undefined when they don't overlap.
 * Ported from ECharts' `graphic.clipRectByRect` so the option code (heatmap, timeline) has
 * no ECharts runtime import (letting ECharts load as a shared async chunk).
 * https://github.com/apache/echarts/blob/master/src/util/graphic.ts
 */
export function clipRectByRect(target: ZRRectLike, clip: ZRRectLike): ZRRectLike | undefined {
  const x = Math.max(target.x, clip.x);
  const x2 = Math.min(target.x + target.width, clip.x + clip.width);
  const y = Math.max(target.y, clip.y);
  const y2 = Math.min(target.y + target.height, clip.y + clip.height);

  if (x2 >= x && y2 >= y) {
    return { x, y, width: x2 - x, height: y2 - y };
  }
  return undefined;
}

/**
 * Canvas shadow applied to a cell in its emphasis (hover) state. Assignable to
 * an element's `emphasis.style` (a subset of ECharts' path style props).
 */
export interface BinnedHeatmapCellShadow {
  shadowBlur: number;
  shadowColor: string;
}

/**
 * Approximate `theme.shadows.z3` for canvas rendering. The theme's z3 is a CSS
 * box-shadow string that can't be applied to a canvas element, so we map it to a
 * fixed blur plus a theme-derived shadow color (darker/denser on dark themes).
 * Used by the cells' emphasis state so hovering the visualMap (`hoverLink`) or a
 * cell lifts the matching cells, mirroring the ECharts heatmap-cartesian example.
 */
export function getBinnedHeatmapCellEmphasisShadow(theme: GrafanaTheme2): BinnedHeatmapCellShadow {
  return {
    shadowBlur: 10,
    shadowColor: theme.isDark ? 'rgba(0, 0, 0, 0.75)' : 'rgba(0, 0, 0, 0.35)',
  };
}

/**
 * Build the `renderItem` for the binned heatmap custom series: convert each
 * cell's two corners to pixels via `api.coord`, draw a rect clipped to the grid,
 * and fill it with the color the visualMap computed for this item
 * (`api.visual('color')`). Works on a continuous `time` x-axis, unlike the
 * native heatmap series.
 *
 * The returned rect carries an `emphasis.style` shadow so hovering the visualMap
 * (`hoverLink`) or an individual cell lifts the matching cells.
 * See https://echarts.apache.org/en/option.html#series-custom.renderItem
 */
export function makeBinnedHeatmapRenderItem(
  emphasisShadow: BinnedHeatmapCellShadow,
  cellGap = 0
): CustomSeriesRenderItem {
  return (params, api) => {
    const start = api.coord([api.value(0), api.value(1)]);
    const end = api.coord([api.value(2), api.value(3)]);

    // With no gap, +0.5 closes sub-pixel seams between adjacent cells. A gap
    // shrinks each cell from its far edges; cells stay at least 1px.
    const pad = cellGap > 0 ? -cellGap : 0.5;
    const rect: ZRRectLike = {
      x: Math.min(start[0], end[0]),
      y: Math.min(start[1], end[1]),
      width: Math.max(1, Math.abs(end[0] - start[0]) + pad),
      height: Math.max(1, Math.abs(end[1] - start[1]) + pad),
    };

    // ECharts types `coordSys` only as `{ type }`, but on cartesian2d it also
    // carries the grid rect at runtime; narrow to our Rect to clip against it.
    if (!isRect(params.coordSys)) {
      return;
    }
    const shape = clipRectByRect(rect, params.coordSys);

    if (!shape) {
      return;
    }

    return {
      type: 'rect',
      shape,
      // Fill each cell with the color the visualMap computed for this item.
      // (`api.style()` is deprecated for custom series; set the style directly.)
      style: { fill: api.visual('color') },
      emphasis: { style: emphasisShadow },
    };
  };
}

/**
 * Build the binned heatmap custom series. `yAxisIndex` defaults to 0 (the bucket
 * axis). `zlevel` places the cells on the series canvas layer (see the panel's
 * `zLevel.series`), matching the cartesian series so layered canvas capture can
 * isolate the series draw calls.
 */
export function getBinnedHeatmapSeries(
  data: BinnedHeatmapData,
  tooltipCtx: BinnedHeatmapTooltipContext,
  yAxisIndex = 0,
  zlevel?: number,
  { cellGap }: { cellGap?: number } = {}
): CustomSeriesOption {
  return {
    name: 'Heatmap',
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    yAxisIndex,
    zlevel,
    renderItem: makeBinnedHeatmapRenderItem(getBinnedHeatmapCellEmphasisShadow(tooltipCtx.theme), cellGap),
    // Map tuple dims to axes: x spans dims [0, 2] (xStart..xEnd), y spans [1, 3]
    // (yStart..yEnd), and the tooltip reads the value dim.
    // See https://echarts.apache.org/en/option.html#series-custom.encode
    encode: { x: [0, 2], y: [1, 3], tooltip: [HEATMAP_VALUE_DIM] },
    data: encodeBinnedHeatmapData(data.cells),
    // Exclude from the toggle legend; the cell layer isn't a togglable series.
    legendHoverLink: false,
    // Per-series tooltip so a hovered cell reads like core Grafana's heatmap.
    // https://echarts.apache.org/en/option.html#series-custom.tooltip
    tooltip: seriesTooltip(buildBinnedHeatmapTooltipModel(data, tooltipCtx), tooltipCtx.tooltipSink),
  };
}

/**
 * Continuous visualMap that colors only the binned heatmap series (by
 * `seriesIndex`), mapping the cell value dim ({@link HEATMAP_VALUE_DIM}) to a
 * color. Shares its placement/sizing with the matrix layout via
 * {@link getHeatmapVisualMap}; `hoverLink` highlights the cells in a hovered
 * value range (the highlight shadow lives on the series emphasis state, see
 * {@link makeBinnedHeatmapRenderItem}).
 */
export function getBinnedHeatmapVisualMap({
  data,
  theme,
  seriesIndex,
  placement = 'right',
  scheme,
  color,
  formatDisplayValue,
}: {
  data: BinnedHeatmapData;
  theme: GrafanaTheme2;
  seriesIndex: number;
  scheme?: HeatmapColorScheme;
  color?: CoreHeatmapOptions['color'];
  placement: HeatmapColorScalePlacement;
  formatDisplayValue: DisplayProcessor;
}): ContinuousVisualMapOption {
  return getHeatmapVisualMap({
    valueMin: data.valueMin,
    valueMax: data.valueMax,
    dimension: HEATMAP_VALUE_DIM,
    theme,
    seriesIndex,
    scheme,
    placement,
    color,
    formatDisplayValue,
  });
}
