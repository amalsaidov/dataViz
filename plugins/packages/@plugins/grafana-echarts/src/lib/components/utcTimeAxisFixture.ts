import { dateTime, FieldType, type TimeRange, toDataFrame } from '@grafana/data';

// Shared input for the #770 multi-week time-axis tests: 21 daily points in a 3-week range.
const DAY = 24 * 60 * 60 * 1000;
const from = Date.parse('2026-08-03T00:00:00.000Z');
const to = from + 21 * DAY;

export const multiWeekRange: TimeRange = {
  from: dateTime(from),
  to: dateTime(to),
  raw: { from: 'now-21d', to: 'now' },
};

export const multiWeekFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: Array.from({ length: 21 }, (_, i) => from + i * DAY), config: {} },
    {
      name: 'reports',
      type: FieldType.number,
      values: Array.from({ length: 21 }, (_, i) => 10 + (i % 7)),
      config: { displayName: 'reports' },
    },
  ],
});
