import { FieldType, toDataFrame } from '@grafana/data';
import { findNumericTextField, getDuplicateFieldIssue, getFieldShapeIssue, getTextNumberIssue } from './dataShape';
const frame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [1, 2] },
    { name: 'label', type: FieldType.string, values: ['a', 'b'] },
  ],
});

describe('getFieldShapeIssue', () => {
  it('gives the number field issue when no frame has a number field', () => {
    expect(getFieldShapeIssue([frame], { number: true })).toMatchObject({ needsNumberField: true });
  });

  it('gives the time field issue first', () => {
    const numbers = toDataFrame({ fields: [{ name: 'v', type: FieldType.number, values: [1] }] });
    expect(getFieldShapeIssue([numbers], { time: true, number: true })).toMatchObject({ needsTimeField: true });
  });

  it('gives no issue when the fields are there', () => {
    const numbers = toDataFrame({ fields: [{ name: 'v', type: FieldType.number, values: [1] }] });
    expect(getFieldShapeIssue([frame, numbers], { time: true, number: true })).toBeUndefined();
  });

  it('counts a field with no values as missing', () => {
    const empty = toDataFrame({ fields: [{ name: 'v', type: FieldType.number, values: [] }] });
    expect(getFieldShapeIssue([empty], { number: true })).toMatchObject({ needsNumberField: true });
  });
});

describe('getTextNumberIssue', () => {
  it('names a string field with numeric text when no number field has values', () => {
    const text = toDataFrame({ fields: [{ name: 'mainstat', type: FieldType.string, values: ['120', 'a'] }] });
    expect(getTextNumberIssue([text])).toEqual({
      reason: 'number-field-has-text',
      message: 'Field mainstat has text values. Convert it with Convert field type.',
    });
  });

  it('names a number field with a text value', () => {
    const mixed = toDataFrame({ fields: [{ name: 'v', type: FieldType.number, values: [1, 'x'] }] });
    expect(getTextNumberIssue([mixed])).toMatchObject({ reason: 'number-field-has-text' });
  });

  it('keeps a numeric label next to a number field', () => {
    const ok = toDataFrame({
      fields: [
        { name: 'status', type: FieldType.string, values: ['200'] },
        { name: 'v', type: FieldType.number, values: [1] },
      ],
    });
    expect(getTextNumberIssue([ok])).toBeUndefined();
  });

  it('gives no issue for a string field with no numeric text', () => {
    expect(getTextNumberIssue([frame])).toBeUndefined();
  });
});

describe('getDuplicateFieldIssue', () => {
  it('names two fields with the same name and labels in one frame', () => {
    const dup = toDataFrame({
      fields: [
        { name: 'v', type: FieldType.number, values: [1] },
        { name: 'v', type: FieldType.number, values: [2] },
      ],
    });
    expect(getDuplicateFieldIssue([dup])).toEqual({
      reason: 'duplicate-field-name',
      message: 'Two fields have the name v. Rename one with Organize fields.',
    });
  });

  it('keeps fields with the same name and different labels', () => {
    const wide = toDataFrame({
      fields: [
        { name: 'v', type: FieldType.number, values: [1], labels: { host: 'a' } },
        { name: 'v', type: FieldType.number, values: [2], labels: { host: 'b' } },
      ],
    });
    expect(getDuplicateFieldIssue([wide])).toBeUndefined();
  });
});

describe('findNumericTextField', () => {
  it('finds a string field with only numbers as text', () => {
    const text = toDataFrame({ fields: [{ name: 'n', type: FieldType.string, values: ['1', ' 2.5 '] }] });
    expect(findNumericTextField([frame, text])?.name).toBe('n');
  });

  it('skips a string field with one value that is not a number', () => {
    const mixed = toDataFrame({ fields: [{ name: 'n', type: FieldType.string, values: ['1', 'a'] }] });
    expect(findNumericTextField([mixed])).toBeUndefined();
  });
});
