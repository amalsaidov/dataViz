import { type DataFrame, type Field, FieldType } from '@grafana/data';
import { isFlameGraphFrame } from 'lib/echarts/converters/hierarchy';
import { getFieldShapeIssue, getTextNumberIssue } from './dataShape';
import { type ChartDataIssue } from './types';

/** The fix steps for each hierarchy data issue (#927). */
export const HIERARCHY_ISSUE_MESSAGES = {
  'flame-field-missing': (name: string) =>
    `Field ${name} is missing. A flame graph frame needs the fields level, value and label. Rename a field with Organize fields.`,
  'flame-level-jump': (row: number, level: number) =>
    `Row ${row} has level ${level}. Each row can be at most one level below the row before it, and the first row has level 0.`,
};

// The fields of a flame graph frame: https://grafana.com/developers/dataplane/ (see data-plane/flame-graph.md).
const FLAME_FIELDS = [
  { name: 'level', type: FieldType.number },
  { name: 'value', type: FieldType.number },
  { name: 'label' },
];

/** The flame graph issue of one frame, else `undefined`. Rows are numbered from 1. */
function getFlameGraphIssue(frame: DataFrame): ChartDataIssue | undefined {
  const missing = FLAME_FIELDS.find(
    ({ name, type }) => !frame.fields.some((field) => field.name === name && (type == null || field.type === type))
  );
  if (missing) {
    return { reason: 'flame-field-missing', message: HIERARCHY_ISSUE_MESSAGES['flame-field-missing'](missing.name) };
  }
  const levels = frame.fields.find((field): field is Field<number> => field.name === 'level')!.values;
  let previous = -1;
  for (let row = 0; row < levels.length; row++) {
    const level = levels[row] ?? 0;
    // A deeper jump has no parent, so the tree puts the row at the top.
    if (level > previous + 1) {
      return { reason: 'flame-level-jump', message: HIERARCHY_ISSUE_MESSAGES['flame-level-jump'](row + 1, level) };
    }
    previous = level;
  }
  return undefined;
}

/**
 * The data issue of a hierarchy frame, with the steps to fix it, else `undefined`.
 * Flame graph frames: data-plane/flame-graph.md. Flat frames: https://grafana.com/developers/dataplane/numeric
 */
export function getHierarchyIssue(frames: DataFrame[]): ChartDataIssue | undefined {
  const flameFrame = frames.find(isFlameGraphFrame);
  if (flameFrame) {
    return getFlameGraphIssue(flameFrame);
  }
  const shape = getFieldShapeIssue(frames, { number: true });
  return shape && (getTextNumberIssue(frames) ?? shape);
}
