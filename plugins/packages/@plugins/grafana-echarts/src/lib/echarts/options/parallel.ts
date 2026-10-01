import { type GrafanaTheme2 } from '@grafana/data';
import { type VizLegendOptions } from '@grafana/schema';
import { type ParallelComponentOption, type ParallelSeriesOption } from 'echarts';
import { format } from 'echarts/core';
import { type ECBasicOption } from 'echarts/types/dist/shared';
import {
  PARALLEL_ANIMATION_ENABLED_DEFAULT,
  PARALLEL_LAYOUT_DEFAULT,
  PARALLEL_LINE_OPACITY_DEFAULT,
  PARALLEL_LINE_WIDTH_DEFAULT,
} from 'editor/parallel';
import { type ParallelLayout } from 'editor/types';
import { AXIS_FONT_SIZE, createBaseOptions, getThemeTextStyle, getUPlotGridColor } from 'lib/echarts/options/base';
import { applyAdvancedDefaults } from 'lib/echarts/options/editorMode';
import { type PanelOptions } from 'types';

/** Base option for parallel-coordinates charts. Axes and series data are merged at render time. */
export const parallelDefaultOptions: ECBasicOption = {
  ...createBaseOptions({ includeLegend: true }),
};

/* --- Parallel option builders ------------------------------------------------
 * Each helper omits its ECharts key at the default so an untouched parallel chart
 * renders on ECharts' own defaults, and only opted-in options add keys. */

/* --- Layout box ---------------------------------------------------------------
 * The `parallel` coordinate system carries its own box instead of a `grid`, and
 * has no `containLabel`, so the room for labels has to be reserved in real px.
 * ECharts' own defaults (80/80/60/60) leave a 400x300 panel drawing into 240x180
 * — 36% of the canvas — which is why a parallel panel looked so much more padded
 * than its cartesian neighbours. The anchor positions below were measured off a
 * rendered chart (see `multivariate.canvas.test.tsx`).
 */

/**
 * Vertical allowance for one centred line of axis text.
 *
 * ECharts anchors both tick labels and axis names with `textBaseline: 'middle'`,
 * so half the line box sits above the anchor point. How tall that box actually
 * is depends on the browser's font rendering, which the jsdom canvas these
 * values were measured against does *not* reproduce — jsdom reports where the
 * anchor went, not how far the glyphs reach from it. An earlier value of roughly
 * half the 12px font looked fine in the measurements and still clipped the top
 * of the axis names in a real browser, so this is deliberately generous. Prefer
 * spending a few px here over trusting a metric jsdom cannot give us.
 */
const LABEL_HALF_LINE = 16;

/** ECharts' own `nameGap`: the space it leaves between an axis and its name. */
const AXIS_NAME_GAP = 15;

/** Measured offset of a tick label from its axis line. */
const TICK_LABEL_GAP = 8;

/**
 * Horizontal layout — axes run vertically, left to right.
 *
 * `top` holds the axis-name row, which ECharts centres a `nameGap` above each
 * axis line. `left`/`right` cover the outermost names, centred *on* their axis
 * and so overhanging by half their width; tick labels need nothing there, being
 * drawn inside each axis. `bottom` clears the last tick label.
 */
const HORIZONTAL_BOX = {
  top: AXIS_NAME_GAP + LABEL_HALF_LINE,
  bottom: LABEL_HALF_LINE,
  left: 40,
  right: 40,
};

/**
 * Vertical layout — axes run horizontally, stacked top to bottom.
 *
 * Not a rotation of the above: ECharts draws each name *past the right end* of
 * its axis and left-aligned, so `right` is a name column rather than padding,
 * and undersizing it pushes the names clean off the canvas. The name is centred
 * on the axis itself rather than offset by a `nameGap`, so `top` only owes it
 * half a line. Tick labels sit under each axis, so `bottom` clears the last row
 * and `left` covers half of the first label.
 */
const VERTICAL_BOX = {
  top: LABEL_HALF_LINE,
  bottom: TICK_LABEL_GAP + LABEL_HALF_LINE,
  left: 16,
  right: 80,
};

/**
 * Widest axis name in px. A longer name is truncated with an ellipsis, so that
 * the name room does not take a narrow panel.
 * https://echarts.apache.org/en/option.html#parallelAxis.nameTextStyle.overflow
 */
const AXIS_NAME_MAX_WIDTH = 120;

/** Space between a name and the panel edge. */
const AXIS_NAME_EDGE_GAP = 4;

/**
 * Width of an axis name in px, at most `AXIS_NAME_MAX_WIDTH`. Uses the ECharts
 * text measure, so the value agrees with the drawn name.
 * https://echarts.apache.org/en/api.html#echarts.format
 */
function getAxisNameWidth(name: string, theme: GrafanaTheme2): number {
  const font = `${AXIS_FONT_SIZE}px ${theme.typography.fontFamily}`;
  return Math.min(format.getTextRect(name, font).width, AXIS_NAME_MAX_WIDTH);
}

/**
 * The box sides that hold the axis names. Each side is at least its constant
 * in `HORIZONTAL_BOX` / `VERTICAL_BOX`, and more when a name needs more room.
 * Horizontal: the first and last names are centred on the outer axes, so each
 * side holds half of its name. Vertical: the names are to the right of the
 * axes, so `right` holds the widest name and the name gap.
 */
function getNameSides(isVertical: boolean, axisNames: string[], theme: GrafanaTheme2) {
  const widths = axisNames.map((name) => getAxisNameWidth(name, theme));
  if (isVertical) {
    const widest = Math.max(0, ...widths);
    return {
      left: VERTICAL_BOX.left,
      right: Math.max(VERTICAL_BOX.right, widest + AXIS_NAME_GAP + AXIS_NAME_EDGE_GAP),
    };
  }
  const side = (width = 0, min: number) => Math.max(min, Math.ceil(width / 2) + AXIS_NAME_EDGE_GAP);
  return {
    left: side(widths[0], HORIZONTAL_BOX.left),
    right: side(widths[widths.length - 1], HORIZONTAL_BOX.right),
  };
}

/** Reserved for a native ECharts legend, matching the cartesian grid's gap. */
const PARALLEL_LEGEND_PADDING = 12;

/**
 * Axis styling for the parallel coordinate system, mirroring
 * `getCartesianAxisStyle` so tick labels read at the same weight as every other
 * panel — ECharts' own default label color is a muted grey that looked washed
 * out beside Grafana's `text.primary`.
 *
 * Two deliberate departures from the cartesian style: the axis line stays
 * *shown*, because on parallel it is the structural spine rather than a
 * redundant edge, and `splitLine` is omitted, because a parallel axis is a
 * single line with no plane to rule.
 */
function getParallelAxisStyle(theme: GrafanaTheme2): NonNullable<ParallelComponentOption['parallelAxisDefault']> {
  const gridColor = getUPlotGridColor(theme);
  const textStyle = { ...getThemeTextStyle(theme), fontSize: AXIS_FONT_SIZE };

  return {
    axisLine: { show: true, lineStyle: { color: theme.colors.border.medium } },
    axisTick: { show: true, length: 4, lineStyle: { color: gridColor } },
    axisLabel: textStyle,
    // Truncate a long name to the width that `getNameSides` reserves.
    nameTextStyle: { ...textStyle, width: AXIS_NAME_MAX_WIDTH, overflow: 'truncate' },
  };
}

/**
 * The ECharts `parallel` coordinate component: the Advanced "Layout" direction,
 * the layout box, and the shared axis styling.
 *
 * Unlike the other parallel builders this one does *not* omit-at-default — it
 * always writes a box and a `parallelAxisDefault`, because ECharts' defaults for
 * both are the bugs being fixed (see the padding constants above and
 * `getParallelAxisStyle`). `parallelAxisDefault` is merged into each
 * `parallelAxis` without overwriting keys the axis sets itself, so per-axis
 * `dim` / `name` / `type` still win.
 *
 * The box is layout-aware — see `HORIZONTAL_BOX` / `VERTICAL_BOX`, which differ
 * by more than orientation. `axisNames` (in `dim` order) widen the name sides
 * when a name needs more room than the constants give.
 * https://echarts.apache.org/en/option.html#parallel.layout
 */
export function getParallelComponent(
  layout: ParallelLayout | undefined,
  theme: GrafanaTheme2,
  legend?: VizLegendOptions,
  axisNames: string[] = []
): ParallelComponentOption {
  const isVertical = layout === 'vertical';
  const box = { ...(isVertical ? VERTICAL_BOX : HORIZONTAL_BOX), ...getNameSides(isVertical, axisNames, theme) };

  return {
    ...(isVertical ? { layout: 'vertical' as const } : {}),
    ...box,
    bottom: box.bottom + (legend?.placement === 'bottom' ? PARALLEL_LEGEND_PADDING : 0),
    right: box.right + (legend?.placement === 'right' ? PARALLEL_LEGEND_PADDING : 0),
    parallelAxisDefault: getParallelAxisStyle(theme),
  };
}

/**
 * ECharts parallel `series.lineStyle` from the Advanced "Line width" and "Line
 * opacity". Width is omitted at unset/≤0 (ECharts' default stroke); opacity is a
 * 0–100 value scaled to ECharts' 0–1 and omitted when unset. Returns `undefined`
 * when neither is set, so no `lineStyle` is written.
 * https://echarts.apache.org/en/option.html#series-parallel.lineStyle
 */
export function getParallelLineStyle(
  lineWidth: number | undefined,
  lineOpacity: number | undefined
): ParallelSeriesOption['lineStyle'] | undefined {
  const lineStyle: NonNullable<ParallelSeriesOption['lineStyle']> = {};
  if (lineWidth != null && lineWidth > 0) {
    lineStyle.width = lineWidth;
  }
  if (lineOpacity != null) {
    lineStyle.opacity = lineOpacity / 100;
  }
  return Object.keys(lineStyle).length > 0 ? lineStyle : undefined;
}

/**
 * Default values for every Advanced-gated parallel option, keyed by its
 * `PanelOptions` path. Spread over the stored options in Default editor mode (see
 * `applyParallelEditorModeDefaults`) so a panel with Advanced values configured
 * and then hidden renders exactly like an untouched parallel chart. The
 * Default-tier `parallelSmooth` is intentionally absent (it is never hidden).
 * `animation` is included so Default mode restores animation too. Mirrors
 * `ADVANCED_RADAR_DEFAULTS`.
 */
export const ADVANCED_PARALLEL_DEFAULTS: Partial<PanelOptions> = {
  parallelLayout: PARALLEL_LAYOUT_DEFAULT,
  parallelLineWidth: PARALLEL_LINE_WIDTH_DEFAULT,
  parallelLineOpacity: PARALLEL_LINE_OPACITY_DEFAULT,
  animation: { enabled: PARALLEL_ANIMATION_ENABLED_DEFAULT },
};

/**
 * Normalize a parallel panel's options for rendering by editor mode: Default mode
 * spreads `ADVANCED_PARALLEL_DEFAULTS` over them so hidden Advanced values don't
 * affect the render; Advanced / API mode passes them through. Registered in the
 * `editorMode.ts` dispatch for the multivariate family.
 */
export function applyParallelEditorModeDefaults(options: PanelOptions): PanelOptions {
  return applyAdvancedDefaults(options, ADVANCED_PARALLEL_DEFAULTS);
}
