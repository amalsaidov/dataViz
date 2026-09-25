import {
  type DataFrame,
  type FieldConfig,
  FieldColorModeId,
  FieldType,
  ThresholdsMode,
  toDataFrame,
} from '@grafana/data';
import { MappingType } from '@grafana/schema';
import { render } from '@testing-library/react';
import { AXIS_ZLEVEL, SERIES_ZLEVEL } from 'test/canvas';
import { defaultTimeRange, getAxisCanvasEvents, getComponent } from 'test/panel';
import { type PanelOptions } from 'types';

/**
 * Render harness and fixtures shared by the timeline canvas and integration suites,
 * so both describe the same frames. Bars and value text are on `SERIES_ZLEVEL`, the
 * axes on `AXIS_ZLEVEL`. The fixtures follow core's gdev timeline dashboards.
 */
export const timelineCanvasOptions = (extra: Partial<PanelOptions> = {}): Partial<PanelOptions> => ({
  zLevel: { series: SERIES_ZLEVEL, axis: AXIS_ZLEVEL },
  animation: { enabled: false },
  ...extra,
});

/** Render the timeline panel and read the series and axis layers of one paint. */
export const renderTimeline = async (frames: DataFrame[], options: Partial<PanelOptions> = {}) => {
  const { container } = render(
    getComponent(frames, 'custom', timelineCanvasOptions(options), undefined, undefined, 'timeline')
  );
  return getAxisCanvasEvents(container);
};

const from = defaultTimeRange.from.valueOf();
const step = 20 * 60 * 1000;
/** Nine rows, 20 minutes apart, inside the 3 h test range. */
const times = Array.from({ length: 9 }, (_, i) => from + i * step);

/** String states coloured by value mappings, as in core's `timeline-demo.json`. */
const stateConfig = (custom: Record<string, unknown> = {}): FieldConfig => ({
  color: { mode: FieldColorModeId.Fixed, fixedColor: 'blue' },
  mappings: [
    {
      type: MappingType.ValueToText,
      options: {
        OK: { color: 'green', index: 0 },
        WARN: { color: 'yellow', index: 1 },
        ERROR: { color: 'red', index: 2 },
      },
    },
  ],
  custom: { fillOpacity: 70, lineWidth: 0, ...custom },
});

/** Two string lanes. `undefined` continues a state, `null` is a gap. */
export const stringsFrame = (custom?: Record<string, unknown>) =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: times },
      {
        name: 'server A',
        type: FieldType.string,
        values: ['OK', 'OK', 'WARN', 'WARN', 'ERROR', 'OK', 'OK', 'OK', 'WARN'],
        config: stateConfig(custom),
      },
      {
        name: 'server B',
        type: FieldType.string,
        values: ['ERROR', 'OK', null, 'OK', 'OK', 'WARN', 'ERROR', 'ERROR', 'OK'],
        config: stateConfig(custom),
      },
    ],
  });

/** One string lane: fills the full height. */
export const singleLaneFrame = () =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: times },
      {
        name: 'server A',
        type: FieldType.string,
        values: ['OK', 'OK', 'WARN', 'WARN', 'ERROR', 'OK', 'OK', 'OK', 'WARN'],
        config: stateConfig(),
      },
    ],
  });

/** A boolean lane in the classic palette. */
export const booleansFrame = () =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: times },
      {
        name: 'online',
        type: FieldType.boolean,
        values: [true, true, false, true, false, false, true, true, true],
        config: {
          color: { mode: FieldColorModeId.Fixed, fixedColor: 'purple' },
          mappings: [
            {
              type: MappingType.ValueToText,
              options: {
                true: { color: 'green', text: 'Up', index: 0 },
                false: { color: 'red', text: 'Down', index: 1 },
              },
            },
          ],
          custom: { fillOpacity: 70 },
        },
      },
    ],
  });

/** Numbers in threshold colour mode: merged by threshold step, as in `timeline-thresholds-mappings.json`. */
export const thresholdsFrame = () =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: times },
      {
        name: 'cpu',
        type: FieldType.number,
        values: [10, 20, 55, 60, 90, 95, 40, 30, 85],
        config: {
          color: { mode: FieldColorModeId.Thresholds },
          thresholds: {
            mode: ThresholdsMode.Absolute,
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 50, color: 'orange' },
              { value: 80, color: 'red' },
            ],
          },
          custom: { fillOpacity: 70 },
        },
      },
    ],
  });

/** The Gantt shape: start time, end time and state, as in `timeline-align-endtime.json`. */
export const startEndFrame = () =>
  toDataFrame({
    fields: [
      { name: 'starttime', type: FieldType.time, values: [times[0], times[3], times[6]] },
      { name: 'endtime', type: FieldType.time, values: [times[2], times[5], times[8]] },
      { name: 'state', type: FieldType.string, values: ['OK', 'WARN', 'ERROR'], config: stateConfig() },
    ],
  });

type CanvasEvent = { type: string; props?: Record<string, unknown> };

export interface BarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The bar rects of the last paint. A rect followed by `clip` is the series clip path, not a bar. */
export const barRects = (events: CanvasEvent[]): BarRect[] =>
  events
    .filter((event, i) => event.type === 'rect' && events[i + 1]?.type !== 'clip')
    .map((event) => {
      const { x, y, width, height } = event.props as unknown as BarRect;
      return { x, y, width, height };
    });

/** The value texts of the last paint. */
export const barTexts = (events: CanvasEvent[]): string[] =>
  events.filter((event) => event.type === 'fillText').map((event) => String(event.props?.text));

/** One 8 minute state between two long ones: room for one character only. */
export const shortStateFrame = () =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [times[0], times[4], times[4] + 8 * 60 * 1000] },
      { name: 'server A', type: FieldType.string, values: ['OK', 'ERROR', 'OK'], config: stateConfig() },
    ],
  });
