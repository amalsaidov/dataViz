import { type TimelineValueAlignment, VisibilityMode } from '@grafana/schema';
import { type CustomSeriesOption, type CustomSeriesRenderItem } from 'echarts';
import { type YAXisOption } from 'echarts/types/src/coord/cartesian/AxisModel';
import { type ZRRectLike } from 'echarts/types/src/util/types';
import { type TimelineModel } from 'lib/grafana/timeline/types';
import { clipRectByRect } from 'lib/echarts/options/binnedHeatmap';
import { isRect } from 'lib/echarts/options/narrowing';
import { seriesTooltip } from 'lib/echarts/tooltip/option';
import { buildTimelineTooltipModel, type TimelineItem } from 'lib/echarts/tooltip/timeline';
import { type TimelineTooltipContext } from 'lib/echarts/tooltip/types';

/**
 * ECharts side of the timeline family: the `custom` series that draws each state as a
 * bar, after the ECharts "Gantt of Airport Flights" example
 * (https://echarts.apache.org/examples/en/editor.html?c=custom-gantt-flight).
 * Geometry and text rules are core's state timeline ones:
 * https://github.com/grafana/grafana/blob/main/public/app/core/components/TimelineChart/timeline.ts
 */

/** Space between the bar edge and the value text, in pixels (core's `textPadding`). */
const TEXT_PADDING = 2;

/** Core's value text: weight 500, 12px. */
export const timelineValueFont = (fontFamily: string) => `500 12px ${fontFamily}`;

/** Lane position in Y axis units: 0 is the top of the grid, 1 the bottom. */
export interface TimelineLaneBand {
  top: number;
  bottom: number;
}

/**
 * Lane bands as core lays them out (`distribute` with `SPACE_BETWEEN`): each lane is
 * `rowHeight / count` high, the first lane touches the top edge, the last one the
 * bottom edge, and the gaps share the rest. One lane fills the full height.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/barchart/distribute.ts
 */
export function getTimelineLaneBands(count: number, rowHeight: number): TimelineLaneBand[] {
  const size = count > 1 ? rowHeight : 1;
  const height = size / count;
  const gap = count > 1 ? (1 - size) / (count - 1) : 0;
  return Array.from({ length: count }, (_, i) => {
    const top = i * (height + gap);
    return { top, bottom: top + height };
  });
}

/** Every bar of the model in lane order: the series data order. */
export function getTimelineItems(model: TimelineModel): TimelineItem[] {
  return model.lanes.flatMap((lane, laneIndex) => lane.segments.map((segment) => ({ lane, laneIndex, segment })));
}

/**
 * Encode bars as `[start, end, laneTop, laneBottom]` tuples: x spans dims 0..1 (time),
 * y spans dims 2..3 (lane band). `renderItem` reads both corners.
 * https://echarts.apache.org/en/option.html#series-custom.data
 */
export function encodeTimelineData(items: TimelineItem[], bands: TimelineLaneBand[]): number[][] {
  return items.map(({ segment, laneIndex }) => [
    segment.start,
    segment.end,
    bands[laneIndex].top,
    bands[laneIndex].bottom,
  ]);
}

const charWidthCache = new Map<string, number>();

/**
 * Pixels per character for the value text, as core measures it: the mean width of the
 * printable ASCII characters, rounded up, plus 2.5 to prevent overlap. Measured once
 * per font with a canvas `measureText`, so the option code has no ECharts runtime
 * import.
 * https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/measureText
 */
export function getPxPerChar(font: string): number {
  const cached = charWidthCache.get(font);
  if (cached != null) {
    return cached;
  }
  let chars = '';
  for (let i = 32; i <= 126; i++) {
    chars += String.fromCharCode(i);
  }
  const ctx = typeof document === 'undefined' ? null : document.createElement('canvas').getContext('2d');
  let width = 6;
  if (ctx) {
    ctx.font = font;
    width = Math.ceil(ctx.measureText(chars).width / chars.length);
  }
  const pxPerChar = width + 2.5;
  charWidthCache.set(font, pxPerChar);
  return pxPerChar;
}

export interface TimelineTextOptions {
  showValue: VisibilityMode;
  alignValue: TimelineValueAlignment;
  font: string;
}

/**
 * The value text on a bar, core's `drawPoints` rules: cut to the characters that fit
 * the visible width, with no ellipsis; in Auto mode, no text under 2 characters. Left
 * text sticks to the visible left edge of the grid, center and right use the full bar.
 */
export function getTimelineText(
  text: string,
  box: ZRRectLike,
  grid: ZRRectLike,
  lineWidth: number,
  { showValue, alignValue }: TimelineTextOptions,
  pxPerChar: number
): { text: string; x: number } | undefined {
  if (showValue === VisibilityMode.Never || box.x >= grid.x + grid.width) {
    return undefined;
  }
  // A bar cut by the left grid edge only shows its visible part.
  const visibleWidth = box.x < grid.x ? box.width - (grid.x - box.x) : box.width;
  const maxChars = Math.floor(visibleWidth / pxPerChar);
  if (showValue === VisibilityMode.Auto && maxChars < 2) {
    return undefined;
  }
  let x = Math.round(box.x + box.width / 2);
  if (alignValue === 'left') {
    x = Math.round(Math.max(box.x, grid.x) + lineWidth + TEXT_PADDING);
  } else if (alignValue === 'right') {
    x = Math.round(box.x + box.width - lineWidth - TEXT_PADDING);
  }
  return { text: text.slice(0, maxChars), x };
}

/**
 * The `renderItem` for the timeline: a rect per bar with the value colour at
 * `fillOpacity`, a border of `lineWidth` in the full value colour drawn inside the
 * bar, and the value text. Pixel positions are rounded, as core does.
 * https://echarts.apache.org/en/option.html#series-custom.renderItem
 */
export function makeTimelineRenderItem(
  items: TimelineItem[],
  textOptions: TimelineTextOptions
): CustomSeriesRenderItem {
  const pxPerChar = getPxPerChar(textOptions.font);

  return (params, api) => {
    const item = items[params.dataIndex];
    // ECharts types `coordSys` only as `{ type }`; on cartesian2d it is the grid rect.
    if (!item || !isRect(params.coordSys)) {
      return;
    }
    const grid = params.coordSys;
    const [x0, y0] = api.coord([api.value(0), api.value(2)]);
    const [x1, y1] = api.coord([api.value(1), api.value(3)]);
    const left = Math.round(x0);
    const top = Math.round(y0);
    const box: ZRRectLike = {
      x: left,
      y: top,
      // Core keeps bars at least 1px wide, so short states stay visible.
      width: Math.max(1, Math.round(x1) - left),
      height: Math.round(y1 - y0),
    };
    if (!clipRectByRect(box, grid)) {
      return;
    }

    const { segment, lane } = item;
    const lineWidth = lane.lineWidth;
    const inset = lineWidth / 2;
    const children: NonNullable<Extract<ReturnType<CustomSeriesRenderItem>, { type: 'group' }>['children']> = [
      {
        type: 'rect',
        // The border sits inside the bar, as in core.
        shape: {
          x: box.x + inset,
          y: box.y + inset,
          width: Math.max(0, box.width - lineWidth),
          height: Math.max(0, box.height - lineWidth),
        },
        style: {
          fill: segment.fillColor,
          ...(lineWidth > 0 ? { stroke: segment.color, lineWidth } : {}),
        },
      },
    ];

    const label = getTimelineText(segment.text, box, grid, lineWidth, textOptions, pxPerChar);
    if (label && label.text.length > 0) {
      children.push({
        type: 'text',
        x: label.x,
        y: Math.round(box.y + box.height / 2),
        silent: true,
        style: {
          text: label.text,
          fill: segment.textColor,
          font: textOptions.font,
          align: textOptions.alignValue,
          verticalAlign: 'middle',
        },
      });
    }

    return { type: 'group', children };
  };
}

/**
 * The lane axis: a value axis from 0 (top) to 1 (bottom), with one label per lane at
 * the lane centre. A value axis, not a category one, because category labels sit at
 * band centres and core's lanes do not (see `getTimelineLaneBands`).
 *
 * `grid.containLabel` measures the default ticks, not `customValues`, so ticks that are
 * not lane centres format as the widest name to reserve enough width.
 * https://echarts.apache.org/en/option.html#yAxis.axisLabel.customValues
 */
export function getTimelineYAxis(
  model: TimelineModel,
  bands: TimelineLaneBand[],
  labelStyle: { color?: string; fontFamily?: string; fontSize?: number } = {},
  zlevel?: number
): YAXisOption {
  const centres = bands.map((band) => (band.top + band.bottom) / 2);
  const names = new Map(centres.map((centre, i) => [centre, model.lanes[i].name]));
  const widest = model.lanes.reduce((a, lane) => (lane.name.length > a.length ? lane.name : a), '');

  return {
    type: 'value',
    min: 0,
    max: 1,
    inverse: true,
    axisLine: { show: false },
    axisTick: { show: false },
    splitLine: { show: false },
    // Core draws no horizontal cursor line.
    axisPointer: { show: false },
    zlevel,
    axisLabel: {
      ...labelStyle,
      customValues: centres,
      formatter: (value: number) => names.get(value) ?? widest,
    },
  };
}

/**
 * The timeline custom series. `zlevel` places the bars on the series canvas layer, as
 * for the other families. `clip` cuts bars and text at the grid edge, as core's canvas
 * clip does.
 * https://echarts.apache.org/en/option.html#series-custom
 */
export function getTimelineSeries(
  model: TimelineModel,
  bands: TimelineLaneBand[],
  textOptions: TimelineTextOptions,
  tooltipCtx: TimelineTooltipContext,
  zlevel?: number
): CustomSeriesOption {
  const items = getTimelineItems(model);
  return {
    name: 'Timeline',
    type: 'custom',
    coordinateSystem: 'cartesian2d',
    zlevel,
    clip: true,
    renderItem: makeTimelineRenderItem(items, textOptions),
    // https://echarts.apache.org/en/option.html#series-custom.encode
    encode: { x: [0, 1], y: [2, 3] },
    data: encodeTimelineData(items, bands),
    legendHoverLink: false,
    tooltip: seriesTooltip(buildTimelineTooltipModel(items, tooltipCtx), tooltipCtx.tooltipSink),
  };
}
