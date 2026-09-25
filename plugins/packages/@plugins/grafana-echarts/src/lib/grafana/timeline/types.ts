import { type Field } from '@grafana/data';
import { type VizLegendItem } from '@grafana/ui';

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

/** One drawn bar: a state from `start` to `end`. */
export interface TimelineSegment {
  /** Epoch milliseconds. */
  start: number;
  /** Epoch milliseconds. The last segment of a lane ends at the time range end. */
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
