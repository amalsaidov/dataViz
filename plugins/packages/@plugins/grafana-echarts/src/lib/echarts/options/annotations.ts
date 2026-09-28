import { type LineSeriesOption, type MarkLineComponentOption } from 'echarts';
import { type MarkArea2DDataItemOption } from 'echarts/types/src/component/marker/MarkAreaModel';

// Build the ECharts overlay for Grafana annotations on a time x axis, or on a category x axis of
// times (candlestick). Pure ECharts: the Grafana adapter (lib/grafana/annotations.ts) gives the
// times and colors.
// https://echarts.apache.org/en/option.html#series-line.markLine
// https://echarts.apache.org/en/option.html#series-line.markArea

/** An annotation event: a point at `time`, or a region from `time` to `timeEnd`. */
export interface AnnotationMark {
  time: number;
  timeEnd?: number;
  color: string;
}

/** The id and name of the annotation series. A name is necessary: ECharts names an unnamed series `series\0<index>`. */
export const ANNOTATION_SERIES_ID = '__annotations';

// Core defaults: `lines.width` 2, `regions.opacity` 0.1, and a [5, 5] dash (`AnnotationsPlugin.tsx`).
const LINE_WIDTH = 2;
const LINE_DASH = [5, 5];
const REGION_OPACITY = 0.1;

/**
 * One line series with no data that holds all the marks: a dashed vertical line for each point,
 * and for each region a line at each edge and a band between them.
 *
 * The marks are not attached to a data series (as thresholds are), because a legend click that
 * hides that series would remove the marks too. Marks out of the axis range `[min, max]` are
 * dropped, and regions are clipped to it, so no mark draws out of the grid. Returns `undefined`
 * when no mark is in the range.
 */
export function buildAnnotationSeries(
  marks: AnnotationMark[],
  range: { min: number; max: number },
  zlevel?: number
): LineSeriesOption | undefined {
  const lines: NonNullable<MarkLineComponentOption['data']> = [];
  const areas: MarkArea2DDataItemOption[] = [];
  const inRange = (time: number) => time >= range.min && time <= range.max;
  const line = (time: number, color: string) => ({
    xAxis: time,
    lineStyle: { color, width: LINE_WIDTH, type: LINE_DASH },
  });

  for (const mark of marks) {
    if (mark.timeEnd == null) {
      if (inRange(mark.time)) {
        lines.push(line(mark.time, mark.color));
      }
      continue;
    }
    const start = Math.max(mark.time, range.min);
    const end = Math.min(mark.timeEnd, range.max);
    if (start > end) {
      continue;
    }
    // An edge that the range clips has no line, as core clips its lines to the plot.
    if (inRange(mark.time)) {
      lines.push(line(mark.time, mark.color));
    }
    if (inRange(mark.timeEnd)) {
      lines.push(line(mark.timeEnd, mark.color));
    }
    areas.push([{ xAxis: start, itemStyle: { color: mark.color, opacity: REGION_OPACITY } }, { xAxis: end }]);
  }

  if (lines.length === 0 && areas.length === 0) {
    return undefined;
  }

  return {
    id: ANNOTATION_SERIES_ID,
    name: ANNOTATION_SERIES_ID,
    type: 'line',
    data: [],
    silent: true,
    legendHoverLink: false,
    zlevel,
    markLine: { silent: true, symbol: 'none', label: { show: false }, animation: false, data: lines },
    markArea: { silent: true, animation: false, data: areas },
  };
}

/**
 * The annotation series for a category x axis whose categories are the times in `categoryTimes`
 * (ascending), as the candlestick axis. Each time moves to the index of the nearest category,
 * because a category axis rounds a numeric value to an index.
 * https://echarts.apache.org/en/option.html#xAxis.data
 *
 * A time before the first category or after the last one gets an index out of the axis, so
 * `buildAnnotationSeries` drops that point and clips that region as on a time axis.
 */
export function buildCategoryAnnotationSeries(
  marks: AnnotationMark[],
  categoryTimes: number[],
  zlevel?: number
): LineSeriesOption | undefined {
  if (categoryTimes.length === 0) {
    return undefined;
  }
  const toIndex = (time: number) => nearestCategoryIndex(time, categoryTimes);
  const indexed = marks.map((mark) => ({
    ...mark,
    time: toIndex(mark.time),
    timeEnd: mark.timeEnd == null ? undefined : toIndex(mark.timeEnd),
  }));
  return buildAnnotationSeries(indexed, { min: 0, max: categoryTimes.length - 1 }, zlevel);
}

/** The index of the category nearest to `time`: -1 before the first category, `length` after the last. */
function nearestCategoryIndex(time: number, categoryTimes: number[]): number {
  const last = categoryTimes.length - 1;
  if (time < categoryTimes[0]) {
    return -1;
  }
  if (time > categoryTimes[last]) {
    return categoryTimes.length;
  }
  let nearest = 0;
  categoryTimes.forEach((categoryTime, index) => {
    if (Math.abs(categoryTime - time) < Math.abs(categoryTimes[nearest] - time)) {
      nearest = index;
    }
  });
  return nearest;
}
