import { dateTime, FieldType, type TimeRange, toDataFrame } from '@grafana/data';
import { SERIES_ZLEVEL } from 'test/canvas';

// Shared input for the #1067 x grid tests: the bar chart of the annotations canvas test, on more time ranges.
// Each range has 4 bars, one at each quarter of the range.
const DAY = 24 * 60 * 60 * 1000;
const from = Date.parse('2026-07-01T00:00:00.000Z');

/** The span of each time range, by name. */
export const GRID_RANGES: Record<string, number> = {
  '6 hours': DAY / 4,
  '2 days': 2 * DAY,
  '10 days': 10 * DAY,
  '3 months': 92 * DAY,
};

export const gridRange = (span: number): TimeRange => ({
  from: dateTime(from),
  to: dateTime(from + span),
  raw: { from: dateTime(from), to: dateTime(from + span) },
});

export const gridBarsFrame = (span: number) =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [1, 3, 5, 7].map((i) => from + (i * span) / 8) },
      { name: 'cpu', type: FieldType.number, values: [10, 20, 30, 10] },
    ],
  });

// A range of 3 months with daily data (the dashboard example of #1067).
export const dailyRange = gridRange(Date.parse('2026-09-30T23:59:59.000Z') - from);
export const dailyFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: Array.from({ length: 92 }, (_, i) => from + i * DAY) },
    { name: 'v', type: FieldType.number, values: Array.from({ length: 92 }, (_, i) => 1 + (i % 9)) },
  ],
});

export const gridRenderOptions = { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false } };
