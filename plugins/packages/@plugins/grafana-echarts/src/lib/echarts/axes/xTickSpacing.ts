import { type TimeAxisBaseOption } from 'echarts/types/src/coord/axisCommonTypes';

// The x tick spacing of core Grafana: a label width plus a gap of 18 px, else 40 px.
// `calculateSpace` and `X_TICK_VALUE_GAP` in
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/config/UPlotAxisBuilder.ts

/** The core x tick space when no label width is known (`X_TICK_SPACING_NORMAL`). */
export const X_TICK_SPACE_DEFAULT = 40;

/** The core gap between two x tick labels (`X_TICK_VALUE_GAP`). */
export const X_TICK_LABEL_GAP = 18;

/** The minimum distance in pixels between two x ticks, from the widest label. */
export function getXTickSpace(labelWidth: number | undefined): number {
  return labelWidth != null && labelWidth > 0 ? labelWidth + X_TICK_LABEL_GAP : X_TICK_SPACE_DEFAULT;
}

export interface XTickSpacingInput {
  /** The width of the plot in pixels. Unknown before the first layout. */
  plotWidth: number | undefined;
  /** The width in pixels of the widest formatted tick label, measured with the theme font. */
  labelWidth: number | undefined;
}

/**
 * The x-axis options that keep the tick labels apart, as core:
 * - `splitNumber` asks for one tick for each tick space of the plot width.
 *   https://echarts.apache.org/en/option.html#xAxis.splitNumber
 * - `axisLabel.hideOverlap` hides a label that still overlaps another label.
 *   https://echarts.apache.org/en/option.html#xAxis.axisLabel.hideOverlap
 * A category axis does not use `splitNumber`. ECharts selects its labels with
 * `axisLabel.interval` 'auto' from the label size.
 * https://echarts.apache.org/en/option.html#xAxis.axisLabel.interval
 */
export function getXTickSpacing({
  plotWidth,
  labelWidth,
}: XTickSpacingInput): Pick<TimeAxisBaseOption, 'splitNumber'> & { axisLabel: { hideOverlap: true } } {
  const axisLabel = { hideOverlap: true } as const;
  if (plotWidth == null || plotWidth <= 0) {
    return { axisLabel };
  }
  return { splitNumber: Math.max(1, Math.floor(plotWidth / getXTickSpace(labelWidth))), axisLabel };
}
