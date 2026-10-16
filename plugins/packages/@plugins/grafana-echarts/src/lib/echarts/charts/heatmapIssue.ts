import { type DataFrame } from '@grafana/data';
import { type HeatmapLayout } from 'lib/echarts/options/types';
import { isNumberField, isStringField, isTimeField } from 'lib/grafana/narrowing';
import { getFieldShapeIssue } from './dataShape';
import { type ChartDataIssue } from './types';

/** The fix steps for each heatmap data issue (#926). */
export const HEATMAP_ISSUE_MESSAGES = {
  'matrix-axis-missing':
    'Matrix heatmap needs an x field, a y field and a number field. Add a string field for the rows of the y axis.',
  'layout-mismatch': 'This frame looks like a binned heatmap. Change the Layout option to Binned.',
};

const hasField = (frame: DataFrame, test: (field: DataFrame['fields'][number]) => boolean) => frame.fields.some(test);

/**
 * The data issue of a heatmap frame for the selected layout, with the steps to fix it, else `undefined`.
 * Binned frames: https://grafana.com/developers/dataplane/heatmap
 * Matrix frames: a string field for the y axis, and one number field for each x category.
 */
export function getHeatmapIssue(frames: DataFrame[], layout: HeatmapLayout): ChartDataIssue | undefined {
  const shape = getFieldShapeIssue(frames, { number: true });
  if (shape) {
    return shape;
  }
  // The frame that each layout reads: the first frame with a number field.
  const frame = frames.find((f) => f.fields.some(isNumberField));
  if (!frame || frame.meta?.type === 'heatmap-cells') {
    return undefined;
  }
  const hasTime = hasField(frame, isTimeField);
  const hasString = hasField(frame, isStringField);
  if (layout === 'matrix' && !hasString) {
    return hasTime
      ? { reason: 'layout-mismatch', message: HEATMAP_ISSUE_MESSAGES['layout-mismatch'] }
      : { reason: 'matrix-axis-missing', message: HEATMAP_ISSUE_MESSAGES['matrix-axis-missing'] };
  }
  return undefined;
}
