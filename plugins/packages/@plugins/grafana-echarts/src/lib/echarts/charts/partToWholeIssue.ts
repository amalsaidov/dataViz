import { type DataFrame } from '@grafana/data';
import { type PieSliceModel } from 'lib/echarts/converters/types';
import { isNumberField } from 'lib/grafana/narrowing';
import { findNumericTextField } from './dataShape';
import { type ChartDataIssue } from './types';

// Core gives this text when the frame has no field that the pie chart can use.
// https://github.com/grafana/grafana/blob/main/public/app/features/panel/components/PanelDataErrorView.tsx
const CORE_TEXT = 'Cannot visualize data.';

/** The fix steps for each part-to-whole data issue. */
export const PART_TO_WHOLE_ISSUE_MESSAGES = {
  'number-as-text': (name: string) =>
    `${CORE_TEXT} Field "${name}" has numbers as text. Add a Convert field type transformation to make it a number field.`,
  'number-field-missing': `${CORE_TEXT} Add a number field for the slice values. Use a table with a text field for the slice names, or a wide frame with one number field for each slice.`,
  'values-not-positive': (variant: 'pie' | 'funnel') =>
    variant === 'funnel' ? 'Funnel stages need values above zero.' : 'Pie slices need values above zero.',
  'repeated-slice-names': (name: string) =>
    `Many rows have the slice name "${name}". Add a Group by transformation to get one value for each name, or set Show to Calculate.`,
};

const hasNumberField = (frames: DataFrame[]) =>
  frames.some((frame) => frame.fields.some((field) => isNumberField(field) && field.values.length > 0));

/** The first slice name that more than one slice has, else `undefined`. */
function findRepeatedName(slices: PieSliceModel[]): string | undefined {
  const seen = new Set<string>();
  for (const { name } of slices) {
    if (seen.has(name)) {
      return name;
    }
    seen.add(name);
  }
  return undefined;
}

/**
 * The data issue of a part-to-whole frame, with the steps to fix it, else `undefined`.
 * `getSlices` gives the resolved slice model, `allValues` is `reduceOptions.values`.
 * Data plane: https://grafana.com/developers/dataplane/numeric
 */
export function getPartToWholeIssue(
  frames: DataFrame[],
  getSlices: () => PieSliceModel[],
  variant: 'pie' | 'funnel',
  allValues: boolean
): ChartDataIssue | undefined {
  if (!hasNumberField(frames)) {
    const textField = findNumericTextField(frames);
    return textField
      ? { reason: 'number-as-text', message: PART_TO_WHOLE_ISSUE_MESSAGES['number-as-text'](textField.name) }
      : { reason: 'number-field-missing', message: PART_TO_WHOLE_ISSUE_MESSAGES['number-field-missing'] };
  }
  const slices = getSlices();
  const values = slices.map((slice) => slice.value).filter((value): value is number => value != null);
  // All zero values draw the empty circle (`showEmptyCircle`), so only a negative value gives this issue.
  if (values.some((value) => value < 0) && values.every((value) => value <= 0)) {
    return { reason: 'values-not-positive', message: PART_TO_WHOLE_ISSUE_MESSAGES['values-not-positive'](variant) };
  }
  const repeated = allValues ? findRepeatedName(slices) : undefined;
  if (repeated != null) {
    return { reason: 'repeated-slice-names', message: PART_TO_WHOLE_ISSUE_MESSAGES['repeated-slice-names'](repeated) };
  }
  return undefined;
}
