import { type DataFrame, type GrafanaTheme2 } from '@grafana/data';
import { frameToCategorical } from 'lib/echarts/converters/categorical';
import { getFieldShapeIssue, getTextNumberIssue } from './dataShape';
import { type ChartDataIssue } from './types';

/** The fix steps for each multivariate data issue (#928). */
export const MULTIVARIATE_ISSUE_MESSAGES = {
  'too-few-axes': (chart: 'radar' | 'parallel', min: number) =>
    `${chart === 'radar' ? 'Radar' : 'Parallel coordinates'} needs ${min} or more axes. Each row is one axis. Add rows to the query.`,
  'all-values-empty': 'All values are empty. Check the query, or the time range.',
};

// The fewest axes that draw a shape: a radar polygon needs 3, a parallel line needs 2.
const MIN_AXES = { radar: 3, parallel: 2 };

/**
 * The data issue of a multivariate frame, with the steps to fix it, else `undefined`.
 * The chart reads one axis for each row and one polygon or line for each number field.
 * Data plane: https://grafana.com/developers/dataplane/numeric
 */
export function getMultivariateIssue(
  frames: DataFrame[],
  theme: GrafanaTheme2,
  chart: 'radar' | 'parallel'
): ChartDataIssue | undefined {
  const shape = getFieldShapeIssue(frames, { number: true });
  if (shape) {
    return getTextNumberIssue(frames) ?? shape;
  }
  const categorical = frameToCategorical(frames, theme);
  if (!categorical) {
    return undefined;
  }
  if (categorical.series.every(({ values }) => values.every((value) => value == null))) {
    return { reason: 'all-values-empty', message: MULTIVARIATE_ISSUE_MESSAGES['all-values-empty'] };
  }
  if (categorical.categories.length < MIN_AXES[chart]) {
    return { reason: 'too-few-axes', message: MULTIVARIATE_ISSUE_MESSAGES['too-few-axes'](chart, MIN_AXES[chart]) };
  }
  return undefined;
}
