import { type CustomSeriesOption, type CustomSeriesRenderItem } from 'echarts';
import { type AnnotationMark } from 'lib/echarts/options/annotations';
import { isRect } from 'lib/echarts/options/narrowing';
import { SILENT_TOOLTIP_CHROME, seriesTooltip } from 'lib/echarts/tooltip/option';
import { type TooltipModel, type TooltipSink } from 'lib/echarts/tooltip/types';

// The annotation markers under the plot: a triangle for a point and a bar for a region, as core
// `AnnotationMarker` (public/app/plugins/panel/timeseries/plugins/annotations/AnnotationMarker.tsx).
// A custom series draws them, because a marker must have hover events and a position that mixes
// an axis value (the time) with a pixel offset (under the plot). `markPoint` cannot do this.
// https://echarts.apache.org/en/option.html#series-custom

/** The id and name of the marker series. A name is necessary: ECharts names an unnamed series `series\0<index>`. */
export const ANNOTATION_MARKER_SERIES_ID = '__annotation_markers';

// Core marker size: a 10 px wide, 5 px high triangle, and a 5 px high region bar.
const MARKER_HALF_WIDTH = 5;
const MARKER_HEIGHT = 5;
/** Core `ANNOTATION_LANE_SIZE`: the px between two lanes of markers (`plugins/utils.ts`). */
export const ANNOTATION_LANE_SIZE = 7;

interface MarkerOptions {
  /** The tooltip content of the mark at this index of `marks`. */
  tooltip?: (markIndex: number) => TooltipModel;
  sink?: TooltipSink;
  zlevel?: number;
  /** Put the markers of each mark `lane` in their own row, as core "Enable multi-row annotations". */
  multiLane?: boolean;
}

/**
 * One custom series with a marker under the plot for each mark in the axis range `[min, max]`.
 * A region is clipped to the range, as `buildAnnotationSeries` clips its band. Returns
 * `undefined` when no mark is in the range.
 *
 * The series has its own item tooltip, so an "All" (axis) tooltip does not list it as a row, and a
 * Hidden panel tooltip still shows it.
 * https://echarts.apache.org/en/option.html#series-custom.tooltip
 */
export function buildAnnotationMarkerSeries(
  marks: AnnotationMark[],
  range: { min: number; max: number },
  { tooltip, sink, zlevel, multiLane }: MarkerOptions = {}
): CustomSeriesOption | undefined {
  // The index in `marks` of each drawn marker, in data order.
  const markIndexes: number[] = [];
  const data: number[][] = [];
  marks.forEach((mark, index) => {
    const start = Math.max(mark.time, range.min);
    const end = Math.min(mark.timeEnd ?? mark.time, range.max);
    if (start > end) {
      return;
    }
    markIndexes.push(index);
    // The third value is `NaN`, so the markers add nothing to the y axis extent.
    data.push([start, end, NaN]);
  });

  if (data.length === 0) {
    return undefined;
  }

  const renderItem: CustomSeriesRenderItem = (params, api) => {
    const mark = marks[markIndexes[params.dataIndex]];
    // ECharts types `coordSys` only as `{ type }`; on cartesian2d it is the grid rect.
    if (!mark || !isRect(params.coordSys)) {
      return;
    }
    const bottom =
      params.coordSys.y + params.coordSys.height + (multiLane ? (mark.lane ?? 0) * ANNOTATION_LANE_SIZE : 0);
    const x = api.coord([api.value(0), 0])[0];
    const style = { fill: mark.color };
    if (mark.timeEnd == null) {
      return {
        type: 'polygon',
        shape: {
          points: [
            [x, bottom],
            [x - MARKER_HALF_WIDTH, bottom + MARKER_HEIGHT],
            [x + MARKER_HALF_WIDTH, bottom + MARKER_HEIGHT],
          ],
        },
        style,
      };
    }
    const right = api.coord([api.value(1), 0])[0];
    return { type: 'rect', shape: { x, y: bottom, width: right - x, height: MARKER_HEIGHT }, style };
  };

  return {
    id: ANNOTATION_MARKER_SERIES_ID,
    name: ANNOTATION_MARKER_SERIES_ID,
    type: 'custom',
    data,
    // `x: [0, 1]` keeps both edges in the axis extent; `y: 2` is the `NaN` value.
    encode: { x: [0, 1], y: 2 },
    renderItem,
    // The markers are under the plot, out of the grid clip.
    clip: false,
    zlevel,
    tooltip: {
      trigger: 'item',
      // Shown also when the panel tooltip is Hidden (`show: false`), as core renders
      // `AnnotationsPlugin` in each tooltip mode.
      show: true,
      ...SILENT_TOOLTIP_CHROME,
      // An item tooltip gives one item, not an array.
      ...(tooltip &&
        seriesTooltip((params) => tooltip(markIndexes[Array.isArray(params) ? 0 : params.dataIndex]), sink)),
    },
  };
}
