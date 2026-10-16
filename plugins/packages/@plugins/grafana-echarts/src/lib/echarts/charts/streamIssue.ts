import { type DataFrame } from '@grafana/data';
import { type StreamData } from 'lib/echarts/converters/stream';
import { getFieldShapeIssue, getTextNumberIssue } from './dataShape';
import { type ChartDataIssue } from './types';

/** The fix steps for each stream data issue (#929). */
export const STREAM_ISSUE_MESSAGES = {
  'time-field-missing':
    'Theme river needs a time field. Add a time field, or use the Prepare time series transformation.',
  'single-time-point': 'Theme river needs 2 or more time points. Increase the time range, or query more points.',
};

/**
 * The data issue of a stream frame, with the steps to fix it, else `undefined`.
 * `getData` gives the stream model of the frames. `river` is false for the bubble chart, which draws one point.
 * Data plane: https://grafana.com/developers/dataplane/timeseries
 */
export function getStreamIssue(
  frames: DataFrame[],
  getData: () => StreamData | null,
  river: boolean
): ChartDataIssue | undefined {
  const shape = getFieldShapeIssue(frames, { time: true, number: true });
  if (shape?.reason === 'time-field-missing') {
    // No `needsTimeField` flag: with the flag, the Grafana view shows its own text and not the fix step.
    return { reason: shape.reason, message: STREAM_ISSUE_MESSAGES['time-field-missing'] };
  }
  if (shape) {
    return getTextNumberIssue(frames) ?? shape;
  }
  // A river with one time point has no width, so it draws nothing.
  if (!river) {
    return undefined;
  }
  const times = new Set(getData()?.layers.flatMap((layer) => layer.points.map(([time]) => time)));
  if (times.size === 1) {
    return { reason: 'single-time-point', message: STREAM_ISSUE_MESSAGES['single-time-point'] };
  }
  return undefined;
}
