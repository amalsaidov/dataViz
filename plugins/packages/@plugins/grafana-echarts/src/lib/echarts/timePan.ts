import { type AbsoluteTimeRange } from '@grafana/data';
import { type EChartsType } from 'lib/echarts/echarts';

// Pan of the time range with a drag of the x-axis labels, as core time panels
// (`XAxisInteractionAreaPlugin` of `@grafana/ui`, viz contract 26.1).
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/plugins/XAxisInteractionAreaPlugin.tsx

/** A shorter drag is a click, not a pan (core `MIN_PAN_DIST`). */
export const MIN_PAN_DISTANCE = 5;

/** The height in px under the plot grid that counts as the x-axis labels. */
export const X_AXIS_LABEL_BAND = 24;

/**
 * The range after a drag of `dragPixels`, as core `calculatePanRange`: the same width, moved by the time
 * of the dragged pixels. A drag to the right shows earlier time.
 */
export function panTimeRange(range: AbsoluteTimeRange, dragPixels: number, msPerPixel: number): AbsoluteTimeRange {
  const shift = dragPixels * msPerPixel;
  return { from: range.from - shift, to: range.to - shift };
}

/**
 * True when `[x, y]` is on the labels of the bottom x axis: under the grid, and at most
 * `X_AXIS_LABEL_BAND` px from it.
 * https://echarts.apache.org/en/api.html#echartsInstance.containPixel
 */
export function isOnXAxisLabels(chart: EChartsType, x: number, y: number): boolean {
  const grid = { gridIndex: 0 };
  return !chart.containPixel(grid, [x, y]) && chart.containPixel(grid, [x, y - X_AXIS_LABEL_BAND]);
}

/**
 * The time of one pixel of the x axis, or `null` if the axis is not a time axis.
 * https://echarts.apache.org/en/api.html#echartsInstance.convertFromPixel
 */
export function msPerPixel(chart: EChartsType, x: number): number | null {
  const a: unknown = chart.convertFromPixel({ xAxisIndex: 0 }, x);
  const b: unknown = chart.convertFromPixel({ xAxisIndex: 0 }, x + 100);
  if (typeof a !== 'number' || typeof b !== 'number' || !Number.isFinite(a) || !Number.isFinite(b) || a === b) {
    return null;
  }
  return (b - a) / 100;
}
