import { FieldType, toDataFrame } from '@grafana/data';
import { type StreamData } from 'lib/echarts/converters/stream';
import { getStreamIssue, STREAM_ISSUE_MESSAGES } from './streamIssue';

const time = { name: 'time', type: FieldType.time, values: [1, 2] };
const frame = toDataFrame({ fields: [time, { name: 'v', type: FieldType.number, values: [1, 2] }] });
const data =
  (times: number[]): (() => StreamData) =>
  () =>
    ({ layers: [{ name: 'v', points: times.map((t) => [t, 1]) }] }) as StreamData;

describe('getStreamIssue', () => {
  it('gives the time field fix step', () => {
    const noTime = toDataFrame({ fields: [{ name: 'v', type: FieldType.number, values: [1] }] });
    expect(getStreamIssue([noTime], data([]), true)).toEqual({
      reason: 'time-field-missing',
      message: STREAM_ISSUE_MESSAGES['time-field-missing'],
    });
  });

  it('names a field with numbers as text', () => {
    const text = toDataFrame({ fields: [time, { name: 'v', type: FieldType.string, values: ['1', '2'] }] });
    expect(getStreamIssue([text], data([]), true)?.reason).toBe('number-field-has-text');
  });

  it('gives the single time point issue for the river only', () => {
    expect(getStreamIssue([frame], data([1]), true)).toEqual({
      reason: 'single-time-point',
      message: STREAM_ISSUE_MESSAGES['single-time-point'],
    });
    expect(getStreamIssue([frame], data([1]), false)).toBeUndefined();
  });

  it('gives no issue for 2 or more time points', () => {
    expect(getStreamIssue([frame], data([1, 2]), true)).toBeUndefined();
  });
});
