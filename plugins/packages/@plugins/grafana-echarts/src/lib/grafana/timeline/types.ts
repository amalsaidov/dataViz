import { type Field } from '@grafana/data';
import { type VizLegendItem } from '@grafana/ui';

/**
 * How values become bars, core's `TimelineMode`. `changes` (state timeline): one bar per
 * state, from its start to the next state. `samples` (status history): one cell per
 * sample, never merged.
 */
export type TimelineMode = 'changes' | 'samples';

/**
 * The React-free and ECharts-free timeline model. `prepareTimeline` builds it from
 * Grafana frames; the ECharts option (`lib/echarts/options/timeline.ts`) reads only
 * this type. See `data-plane/timeline.md`.
 */
export interface TimelineModel {
  /** One lane per value field, first lane on top. */
  lanes: TimelineLane[];
  /** Read-only legend items: threshold steps, or unique state text/colour pairs. */
  legendItems: VizLegendItem[];
  /**
   * `samples` mode: the time between the first two samples, in milliseconds. Core sizes
   * every cell from it. Unset with fewer than two samples, and then no lane has a cell.
   */
  sampleInterval?: number;
}

export interface TimelineLane {
  /** Display name of the value field. */
  name: string;
  /** The joined value field. The tooltip footer reads its links from here. */
  field: Field;
  /** `custom.lineWidth`, in pixels. */
  lineWidth: number;
  segments: TimelineSegment[];
}

/** One drawn bar: a state from `start` to `end`, or one sample in `samples` mode. */
export interface TimelineSegment {
  /** Epoch milliseconds. */
  start: number;
  /**
   * Epoch milliseconds. The last segment of a lane ends at the time range end. In
   * `samples` mode it equals `start`: the cell width comes from `sampleInterval`.
   */
  end: number;
  /** Formatted value (`field.display`), the text drawn on the bar. */
  text: string;
  /** Value colour from `field.display`: the stroke and the tooltip swatch. */
  color: string;
  /** `color` with `custom.fillOpacity` applied. */
  fillColor: string;
  /** Text colour with contrast against `fillColor`. */
  textColor: string;
  /** Row of the joined frame where the segment starts. */
  rowIndex: number;
}

/** A known data problem. The messages are core's own. */
export interface TimelineIssue {
  reason: 'no-time-field' | 'no-graphable-fields' | 'null-time-value';
  message: string;
}

export type TimelinePrepareResult =
  { model: TimelineModel; issue?: undefined } | { model?: undefined; issue: TimelineIssue };
