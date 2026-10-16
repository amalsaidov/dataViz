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
  /** The lane of the marker under the plot, from 0. Only the markers use it. */
  lane?: number;
}

/** The style of the lines and bands. A width or an opacity of 0 draws no line or no band. */
export interface AnnotationStyle {
  /** Default 2. */
  lineWidth?: number;
  /** Default 0.1. */
  regionOpacity?: number;
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
 * dropped, and regions are clipped to it, so no mark draws out of the grid. `style` sets the line
 * width and the band opacity (https://echarts.apache.org/en/option.html#series-line.markLine.lineStyle).
 * Returns `undefined` when no line or band draws.
 */
export function buildAnnotationSeries(
  marks: AnnotationMark[],
  range: { min: number; max: number },
  zlevel?: number,
  { lineWidth = LINE_WIDTH, regionOpacity = REGION_OPACITY }: AnnotationStyle = {}
): LineSeriesOption | undefined {
  const lines: NonNullable<MarkLineComponentOption['data']> = [];
  const areas: MarkArea2DDataItemOption[] = [];
  const inRange = (time: number) => time >= range.min && time <= range.max;
  const line = (time: number, color: string) => ({
    xAxis: time,
    lineStyle: { color, width: lineWidth, type: LINE_DASH },
  });
  const addLine = (time: number, color: string) => {
    if (lineWidth > 0 && inRange(time)) {
      lines.push(line(time, color));
    }
  };

  for (const mark of marks) {
    if (mark.timeEnd == null) {
      addLine(mark.time, mark.color);
      continue;
    }
    const start = Math.max(mark.time, range.min);
    const end = Math.min(mark.timeEnd, range.max);
    if (start > end) {
      continue;
    }
    // An edge that the range clips has no line, as core clips its lines to the plot.
    addLine(mark.time, mark.color);
    addLine(mark.timeEnd, mark.color);
    if (regionOpacity > 0) {
      areas.push([{ xAxis: start, itemStyle: { color: mark.color, opacity: regionOpacity } }, { xAxis: end }]);
    }
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
 * The marks of a category x axis whose categories are the times in `categoryTimes` (ascending),
 * as the candlestick axis, and the axis range of the indexes. Each time moves to the index of the
 * nearest category, because a category axis rounds a numeric value to an index.
 * https://echarts.apache.org/en/option.html#xAxis.data
 *
 * A time before the first category or after the last one gets an index out of the range, so
 * `buildAnnotationSeries` and `buildAnnotationMarkerSeries` drop that point and clip that region
 * as on a time axis. Returns `undefined` when there is no category.
 */
export function toCategoryAnnotationMarks(
  marks: AnnotationMark[],
  categoryTimes: number[]
): { marks: AnnotationMark[]; range: { min: number; max: number } } | undefined {
  if (categoryTimes.length === 0) {
    return undefined;
  }
  const toIndex = (time: number) => nearestCategoryIndex(time, categoryTimes);
  return {
    marks: marks.map((mark) => ({
      ...mark,
      time: toIndex(mark.time),
      timeEnd: mark.timeEnd == null ? undefined : toIndex(mark.timeEnd),
    })),
    range: { min: 0, max: categoryTimes.length - 1 },
  };
}

/** The annotation lines and bands for a category x axis of times. See `toCategoryAnnotationMarks`. */
export function buildCategoryAnnotationSeries(
  marks: AnnotationMark[],
  categoryTimes: number[],
  zlevel?: number,
  style?: AnnotationStyle
): LineSeriesOption | undefined {
  const indexed = toCategoryAnnotationMarks(marks, categoryTimes);
  return indexed && buildAnnotationSeries(indexed.marks, indexed.range, zlevel, style);
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
