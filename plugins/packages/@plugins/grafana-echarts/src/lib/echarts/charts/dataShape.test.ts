import { FieldType, toDataFrame } from '@grafana/data';
import { getFieldShapeIssue } from './dataShape';

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
