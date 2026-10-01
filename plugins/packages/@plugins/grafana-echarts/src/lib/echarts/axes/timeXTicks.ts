import { type TimeRange } from '@grafana/data';
import { getXTickSpacing } from 'lib/echarts/axes/xTickSpacing';
import { AXIS_FONT_SIZE } from 'lib/echarts/options/base';
import TimeScale, { calcNiceForTimeScale } from 'echarts/lib/scale/Time';
import { getTimeAxisLabelFormatter, getTimeAxisLabelWidth, isUtcTimeZone } from 'lib/grafana/timeAxisFormat';

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
  const timeSplitNumber = splitNumber != null ? Math.min(splitNumber, TIME_SPLIT_NUMBER_MAX) : undefined;
  return {
    ...(timeSplitNumber != null ? { splitNumber: timeSplitNumber } : {}),
    axisLabel: { ...axisLabel, formatter: getTimeAxisLabelFormatter(timeRange, timeZone) },
    splitLine: getEdgeLines(timeRange, timeZone, timeSplitNumber),
  };
}

/**
 * Which grid lines to draw at the axis ends. ECharts adds a tick at an axis end that is not on a step of its
 * ticks (`notNice`). Its grid line is closer to the next line than the step, so it is not drawn, as in core.
 * The ticks come from the time scale of ECharts with the axis options of `getTimeXTicks`.
 * https://echarts.apache.org/en/option.html#xAxis.splitLine.showMinLine
 */
function getEdgeLines(timeRange: TimeRange, timeZone: string, splitNumber: number | undefined) {
  // The ticks do not use the locale or axis breaks.
  const scale = new TimeScale({ useUTC: isUtcTimeZone(timeZone) });
  scale.setExtent(timeRange.from.valueOf(), timeRange.to.valueOf());
  calcNiceForTimeScale(scale, { splitNumber });
  const ticks = scale.getTicks();
  return { showMinLine: !ticks[0]?.notNice, showMaxLine: !ticks[ticks.length - 1]?.notNice };
}
