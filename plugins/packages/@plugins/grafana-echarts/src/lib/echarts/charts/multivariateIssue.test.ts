import { createTheme, FieldType, toDataFrame } from '@grafana/data';
import { getMultivariateIssue, MULTIVARIATE_ISSUE_MESSAGES } from './multivariateIssue';

const theme = createTheme();
const frame = (rows: number, value: (row: number) => number | null = (row) => row) =>
  toDataFrame({
    fields: [
      { name: 'axis', type: FieldType.string, values: Array.from({ length: rows }, (_, i) => `a${i}`) },
      { name: 'v', type: FieldType.number, values: Array.from({ length: rows }, (_, i) => value(i)) },
    ],
  });

describe('getMultivariateIssue', () => {
  it('needs 3 axes for radar and 2 for parallel', () => {
    expect(getMultivariateIssue([frame(2)], theme, 'radar')).toEqual({
      reason: 'too-few-axes',
      message: MULTIVARIATE_ISSUE_MESSAGES['too-few-axes']('radar', 3),
    });
    expect(getMultivariateIssue([frame(2)], theme, 'parallel')).toBeUndefined();
    expect(getMultivariateIssue([frame(1)], theme, 'parallel')?.message).toBe(
      MULTIVARIATE_ISSUE_MESSAGES['too-few-axes']('parallel', 2)
    );
  });

  it('gives the empty issue when all values are null', () => {
    expect(getMultivariateIssue([frame(3, () => null)], theme, 'radar')).toEqual({
      reason: 'all-values-empty',
      message: MULTIVARIATE_ISSUE_MESSAGES['all-values-empty'],
    });
  });

  it('names a field with numbers as text', () => {
    const text = toDataFrame({ fields: [{ name: 'v', type: FieldType.string, values: ['1', '2', '3'] }] });
    expect(getMultivariateIssue([text], theme, 'radar')?.reason).toBe('number-field-has-text');
  });

  it('gives no issue for a valid radar frame', () => {
    expect(getMultivariateIssue([frame(3)], theme, 'radar')).toBeUndefined();
  });
});
