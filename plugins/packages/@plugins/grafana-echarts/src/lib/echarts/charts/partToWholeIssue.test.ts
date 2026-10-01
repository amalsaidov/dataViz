import { FieldType, toDataFrame } from '@grafana/data';
import { type PieSliceModel } from 'lib/echarts/converters/types';
import { getPartToWholeIssue, PART_TO_WHOLE_ISSUE_MESSAGES } from './partToWholeIssue';

const slice = (name: string, value: number | undefined) => ({ name, value }) as PieSliceModel;
const numbers = toDataFrame({ fields: [{ name: 'v', type: FieldType.number, values: [1, 2] }] });

describe('getPartToWholeIssue', () => {
  it('names a string field that has numbers as text', () => {
    const frame = toDataFrame({ fields: [{ name: 'count', type: FieldType.string, values: ['1', '2.5'] }] });
    expect(getPartToWholeIssue([frame], () => [], 'pie', false)).toEqual({
      reason: 'number-as-text',
      message: PART_TO_WHOLE_ISSUE_MESSAGES['number-as-text']('count'),
    });
  });

  it('gives the number field issue for the frame of #921', () => {
    const frame = toDataFrame({
      fields: [
        { name: 'id', type: FieldType.string, values: ['e1', ''] },
        { name: 'massnstat', type: FieldType.string, values: ['120', 'a'] },
      ],
    });
    expect(getPartToWholeIssue([frame], () => [], 'pie', false)?.reason).toBe('number-field-missing');
  });

  it('gives the issue when a slice is negative and no slice is above zero', () => {
    const issue = getPartToWholeIssue([numbers], () => [slice('a', 0), slice('b', -3)], 'pie', false);
    expect(issue).toEqual({ reason: 'values-not-positive', message: 'Pie slices need values above zero.' });
    expect(getPartToWholeIssue([numbers], () => [slice('a', -1)], 'funnel', false)?.message).toBe(
      'Funnel stages need values above zero.'
    );
  });

  it('gives no issue when all slices are zero, so the empty circle shows', () => {
    expect(getPartToWholeIssue([numbers], () => [slice('a', 0), slice('b', 0)], 'pie', false)).toBeUndefined();
  });

  it('gives no zero issue when one slice is above zero', () => {
    expect(getPartToWholeIssue([numbers], () => [slice('a', 0), slice('b', 1)], 'pie', false)).toBeUndefined();
  });

  it('gives the repeated name issue only in All values mode', () => {
    const slices = () => [slice('a', 1), slice('a', 2)];
    expect(getPartToWholeIssue([numbers], slices, 'pie', true)).toEqual({
      reason: 'repeated-slice-names',
      message: PART_TO_WHOLE_ISSUE_MESSAGES['repeated-slice-names']('a'),
    });
    expect(getPartToWholeIssue([numbers], slices, 'pie', false)).toBeUndefined();
  });
});
