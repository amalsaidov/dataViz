import { type TimeRange } from '@grafana/data';
import { getTimeGridTicks } from 'lib/echarts/axes/timeGridTicks';
import { AXIS_FONT_SIZE } from 'lib/echarts/options/base';
import { getTimeAxisLabelFormatter, getTimeAxisLabelWidth } from 'lib/grafana/timeAxisFormat';

/**
 * The tick options of a time x-axis: Grafana's time zone label formatter, and one tick list for the ticks,
 * the grid lines and the labels (#1085). Thus each label is on a grid line.
 * Before the first layout the plot width is not known, and ECharts places the ticks.
 * https://echarts.apache.org/en/option.html#xAxis.axisTick.customValues
 * https://echarts.apache.org/en/option.html#xAxis.axisLabel.customValues
 * https://echarts.apache.org/en/option.html#xAxis.axisLabel.hideOverlap
 */
export function getTimeXTicks(timeRange: TimeRange, timeZone: string, plotWidth: number | undefined) {
  const labelWidth = getTimeAxisLabelWidth(timeRange, timeZone, AXIS_FONT_SIZE);
  const from = timeRange.from.valueOf();
  const to = timeRange.to.valueOf();
  const customValues = getTimeGridTicks({ from, to }, plotWidth, labelWidth, timeZone, getLabelResolution(to - from));
  const formatter = getTimeAxisLabelFormatter(timeRange, timeZone);
  if (customValues.length === 0) {
    return { axisLabel: { hideOverlap: true, formatter } };
  }
  // The distance in px of a tick from a plot edge, and half of a label.
  const edgePx = (ms: number) => (ms / (to - from)) * (plotWidth ?? 0);
  const half = labelWidth / 2;
  return {
    axisTick: { customValues },
    // A label that goes past a plot edge would make ECharts shrink the plot, so only its grid line is drawn.
    // https://echarts.apache.org/en/option.html#xAxis.axisLabel.showMinLabel
    axisLabel: {
      hideOverlap: true,
      formatter,
      customValues,
      ...getEdgeLabels(
        customValues.length,
        edgePx(customValues[0] - from) < half,
        edgePx(to - customValues[customValues.length - 1]) < half
      ),
    },
  };
}

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;

/**
 * The smallest step that the label format of `getTimeAxisLabelFormatter` shows, so two labels never show the
 * same text: `HH:mm` up to one day, `MM/DD` from one week, `YYYY-MM` from one year. The shortest day is 23 h and
 * the shortest month is 28 days.
 */
function getLabelResolution(spanMs: number): number {
  if (spanMs >= 365 * DAY) {
    return 28 * DAY;
  }
  if (spanMs >= 7 * DAY) {
    return DAY - 60 * MINUTE;
  }
  return spanMs > MINUTE && spanMs <= DAY ? MINUTE : 0;
}

/**
 * Which edge labels to hide. One label always stays: a single tick keeps its label, and of two ticks near both
 * edges the first label stays.
 */
export function getEdgeLabels(count: number, nearMin: boolean, nearMax: boolean) {
  const hideMax = nearMax && count > 1;
  const hideMin = nearMin && count > (hideMax ? 2 : 1);
  return { ...(hideMin ? { showMinLabel: false } : {}), ...(hideMax ? { showMaxLabel: false } : {}) };
}
