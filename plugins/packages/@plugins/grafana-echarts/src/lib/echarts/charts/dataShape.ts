import { type DataFrame, type Field, FieldType } from '@grafana/data';
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

/** True when the value is text that reads as a finite number, for example `"120"`. */
export const isNumericText = (value: unknown): boolean =>
  typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value));

/**
 * The data issue when a field holds numbers as text, else `undefined`. A number field with a text value, or a
 * string field with a numeric text value, gets the issue. A string field counts only when no number field has
 * values, because a label such as `"200"` is valid next to a number field.
 * Convert field type: https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/#convert-field-type
 */
export function getTextNumberIssue(frames: DataFrame[]): ChartDataIssue | undefined {
  const checkStrings = !hasField(frames, isNumberField);
  for (const field of frames.flatMap((frame) => frame.fields)) {
    const textInNumber = isNumberField(field) && field.values.some((value) => typeof value === 'string');
    const numericString = checkStrings && field.type === FieldType.string && field.values.some(isNumericText);
    if (textInNumber || numericString) {
      return {
        reason: 'number-field-has-text',
        message: `Field ${field.name} has text values. Convert it with Convert field type.`,
      };
    }
  }
  return undefined;
}

/**
 * The data issue when one frame has two fields with the same name and the same labels, else `undefined`.
 * The chart cannot tell the two series apart. Organize fields can rename one:
 * https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/#organize-fields-by-name
 */
export function getDuplicateFieldIssue(frames: DataFrame[]): ChartDataIssue | undefined {
  for (const frame of frames) {
    const seen = new Set<string>();
    for (const field of frame.fields) {
      const key = JSON.stringify([field.name, field.labels ?? {}]);
      if (seen.has(key)) {
        return {
          reason: 'duplicate-field-name',
          message: `Two fields have the name ${field.name}. Rename one with Organize fields.`,
        };
      }
      seen.add(key);
    }
  }
  return undefined;
}

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

/**
 * The first string field whose values are all numbers as text (for example `"12.5"`), else `undefined`.
 * A chart module names this field in its data issue, so the user can add a Convert field type transformation.
 * https://grafana.com/docs/grafana/latest/panels-visualizations/query-transform-data/transform-data/#convert-field-type
 */
export function findNumericTextField(frames: DataFrame[]): Field | undefined {
  for (const frame of frames) {
    const field = frame.fields.find(
      (f) => f.type === FieldType.string && f.values.length > 0 && f.values.every(isNumericText)
    );
    if (field) {
      return field;
    }
  }
  return undefined;
}
