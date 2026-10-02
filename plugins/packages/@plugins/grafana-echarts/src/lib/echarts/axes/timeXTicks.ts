import { type TimeRange } from '@grafana/data';
import { getXTickSpacing } from 'lib/echarts/axes/xTickSpacing';
import { AXIS_FONT_SIZE } from 'lib/echarts/options/base';
import type { ScaleTick } from 'echarts/types/src/util/types';
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
    ...getGridLines(timeRange, timeZone, timeSplitNumber),
  };
}

// The shortest calendar month. A step of a month or more is not a fixed time, so ECharts keeps its ticks.
const MONTH_MS = 28 * 24 * 60 * 60 * 1000;

/**
 * The grid lines of the axis. Core (uPlot) draws its grid lines one fixed step apart, from one plot edge to
 * the other. ECharts starts its steps again at each larger unit (for example, each month), and its ticks stop
 * at the time range, also when bars make the axis wider than the range.
 * Thus the axis ticks, and with them the grid lines, are put at one step from the ECharts ticks. The labels
 * keep the ECharts ticks. ECharts drops a custom value that is not on the axis.
 * https://echarts.apache.org/en/option.html#xAxis.axisTick.customValues
 * https://echarts.apache.org/en/option.html#xAxis.splitLine
 */
function getGridLines(timeRange: TimeRange, timeZone: string, splitNumber: number | undefined) {
  const ticks = getScaleTicks(timeRange, timeZone, splitNumber);
  const nice = ticks.filter((tick) => !tick.notNice).map((tick) => tick.value);
  const step = mostCommonGap(nice);
  if (step == null || step >= MONTH_MS) {
    return { splitLine: getEdgeLines(ticks) };
  }
  const from = timeRange.from.valueOf();
  const to = timeRange.to.valueOf();
  // One range of margin on each side covers an axis that bars make wider.
  const span = to - from;
  const first = nice[0] - Math.ceil((nice[0] - (from - span)) / step) * step;
  const customValues: number[] = [];
  for (let value = first; value <= to + span; value += step) {
    customValues.push(value);
  }
  return { axisTick: { customValues }, splitLine: { showMinLine: true, showMaxLine: true } };
}

/** The gap that occurs most between two ticks. If two gaps occur equally often, the smaller gap. */
function mostCommonGap(values: number[]): number | undefined {
  const counts = new Map<number, number>();
  values.slice(1).forEach((value, i) => counts.set(value - values[i], (counts.get(value - values[i]) ?? 0) + 1));
  let best: [number, number] | undefined;
  counts.forEach((count, gap) => {
    if (!best || count > best[1] || (count === best[1] && gap < best[0])) {
      best = [gap, count];
    }
  });
  return best?.[0];
}

/**
 * Which grid lines to draw at the axis ends. ECharts adds a tick at an axis end that is not on a step of its
 * ticks (`notNice`). Its grid line is closer to the next line than the step, so it is not drawn, as in core.
 * https://echarts.apache.org/en/option.html#xAxis.splitLine.showMinLine
 */
function getEdgeLines(ticks: ScaleTick[]) {
  return { showMinLine: !ticks[0]?.notNice, showMaxLine: !ticks[ticks.length - 1]?.notNice };
}

/** The ticks of the ECharts time scale with the axis options of `getTimeXTicks`. */
function getScaleTicks(timeRange: TimeRange, timeZone: string, splitNumber: number | undefined): ScaleTick[] {
  // The ticks do not use the locale or axis breaks.
  const scale = new TimeScale({ useUTC: isUtcTimeZone(timeZone) });
  scale.setExtent(timeRange.from.valueOf(), timeRange.to.valueOf());
  calcNiceForTimeScale(scale, { splitNumber });
  return scale.getTicks();
}
