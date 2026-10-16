import { FieldType, toDataFrame } from '@grafana/data';
import { getHeatmapIssue, HEATMAP_ISSUE_MESSAGES } from './heatmapIssue';

const time = { name: 'time', type: FieldType.time, values: [1, 2] };
const value = { name: 'v', type: FieldType.number, values: [1, 2] };
const row = { name: 'host', type: FieldType.string, values: ['a', 'b'] };

describe('getHeatmapIssue', () => {
  it('gives the layout issue for a time frame in the matrix layout', () => {
    expect(getHeatmapIssue([toDataFrame({ fields: [time, value] })], 'matrix')).toEqual({
      reason: 'layout-mismatch',
      message: HEATMAP_ISSUE_MESSAGES['layout-mismatch'],
    });
  });

  it('gives the axis issue for a matrix frame with no string field', () => {
    expect(getHeatmapIssue([toDataFrame({ fields: [value] })], 'matrix')).toEqual({
      reason: 'matrix-axis-missing',
      message: HEATMAP_ISSUE_MESSAGES['matrix-axis-missing'],
    });
  });

  it('gives no issue for a valid matrix frame or a valid binned frame', () => {
    expect(getHeatmapIssue([toDataFrame({ fields: [row, value] })], 'matrix')).toBeUndefined();
    expect(getHeatmapIssue([toDataFrame({ fields: [time, value] })], 'binned')).toBeUndefined();
  });

  it('keeps the number field issue first', () => {
    expect(getHeatmapIssue([toDataFrame({ fields: [row] })], 'matrix')).toMatchObject({ needsNumberField: true });
  });
});
