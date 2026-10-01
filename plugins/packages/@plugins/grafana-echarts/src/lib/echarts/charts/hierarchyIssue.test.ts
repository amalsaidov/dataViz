import { FieldType, toDataFrame } from '@grafana/data';
import { getHierarchyIssue, HIERARCHY_ISSUE_MESSAGES } from './hierarchyIssue';

const flame = (levels: number[]) =>
  toDataFrame({
    fields: [
      { name: 'level', type: FieldType.number, values: levels },
      { name: 'value', type: FieldType.number, values: levels.map(() => 1) },
      { name: 'label', type: FieldType.string, values: levels.map((_, i) => `f${i}`) },
    ],
  });

describe('getHierarchyIssue', () => {
  it('names the missing field of a flame graph frame', () => {
    const frame = toDataFrame({
      meta: { preferredVisualisationType: 'flamegraph' },
      fields: [
        { name: 'level', type: FieldType.number, values: [0] },
        { name: 'label', type: FieldType.string, values: ['a'] },
      ],
    });
    expect(getHierarchyIssue([frame])).toEqual({
      reason: 'flame-field-missing',
      message: HIERARCHY_ISSUE_MESSAGES['flame-field-missing']('value'),
    });
  });

  it('names the row with a level jump', () => {
    expect(getHierarchyIssue([flame([0, 1, 3])])).toEqual({
      reason: 'flame-level-jump',
      message: HIERARCHY_ISSUE_MESSAGES['flame-level-jump'](3, 3),
    });
    expect(getHierarchyIssue([flame([1, 2])])?.reason).toBe('flame-level-jump');
  });

  it('gives no issue for a valid flame graph frame', () => {
    expect(getHierarchyIssue([flame([0, 1, 2, 1, 0])])).toBeUndefined();
  });

  it('names a field with numbers as text on the flat path', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'name', type: FieldType.string, values: ['a', 'b'] },
        { name: 'size', type: FieldType.string, values: ['1', '2'] },
      ],
    });
    expect(getHierarchyIssue([frame])?.reason).toBe('number-field-has-text');
  });
});
