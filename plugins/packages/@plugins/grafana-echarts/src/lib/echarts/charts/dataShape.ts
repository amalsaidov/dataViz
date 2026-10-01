import { type DataFrame } from '@grafana/data';
import { isNumberField, isTimeField } from 'lib/grafana/narrowing';
import { type ChartDataIssue } from './types';

/** The field types that a chart kind needs to draw. */
export interface ChartFieldNeeds {
  time?: boolean;
  number?: boolean;
}

// The texts of the Grafana error view for `needsTimeField` and `needsNumberField`.
// https://github.com/grafana/grafana/blob/main/public/app/features/panel/components/PanelDataErrorView.tsx
const NO_TIME_FIELD = 'Data is missing a time field';
const NO_NUMBER_FIELD = 'Data is missing a number field';

const hasField = (frames: DataFrame[], test: typeof isTimeField): boolean =>
  frames.some((frame) => frame.fields.some((field) => test(field) && field.values.length > 0));

/**
 * The data issue when no frame has a field type that the chart kind needs, else `undefined`.
 * Each chart module calls it from `getDataIssue`, so the panel shows the Grafana error view, not a blank chart.
 */
export function getFieldShapeIssue(frames: DataFrame[], needs: ChartFieldNeeds): ChartDataIssue | undefined {
  if (needs.time && !hasField(frames, isTimeField)) {
    return { reason: 'time-field-missing', message: NO_TIME_FIELD, needsTimeField: true };
  }
  if (needs.number && !hasField(frames, isNumberField)) {
    return { reason: 'number-field-missing', message: NO_NUMBER_FIELD, needsNumberField: true };
  }
  return undefined;
}
