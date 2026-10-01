import { type TimeRange } from '@grafana/data';
import { getXTickSpacing } from 'lib/echarts/axes/xTickSpacing';
import { AXIS_FONT_SIZE } from 'lib/echarts/options/base';
import { getTimeAxisLabelFormatter, getTimeAxisLabelWidth } from 'lib/grafana/timeAxisFormat';

// The ECharts default `splitNumber` of a time axis. A wide plot keeps it, so it keeps the ticks of core.
// https://echarts.apache.org/en/option.html#xAxis.splitNumber
const TIME_SPLIT_NUMBER_MAX = 6;

/**
 * The tick options of a time x-axis: Grafana's timezone label formatter, and the
 * shared tick spacing rule from the width of the formatted labels.
 * https://echarts.apache.org/en/option.html#xAxis.splitNumber
 */
export function getTimeXTicks(timeRange: TimeRange, timeZone: string, plotWidth: number | undefined) {
  const { splitNumber, axisLabel } = getXTickSpacing({
    plotWidth,
    labelWidth: getTimeAxisLabelWidth(timeRange, timeZone, AXIS_FONT_SIZE),
  });
  return {
    ...(splitNumber != null ? { splitNumber: Math.min(splitNumber, TIME_SPLIT_NUMBER_MAX) } : {}),
    axisLabel: { ...axisLabel, formatter: getTimeAxisLabelFormatter(timeRange, timeZone) },
  };
}
