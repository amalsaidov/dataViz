import { dateTime, FieldType, type TimeRange, toDataFrame } from '@grafana/data';

// Shared input for the x grid matrix (#1087): time ranges, bar positions and time zones.
const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// The end of each range. It is not on a round time, as the "now" of a dashboard.
const TO = Date.parse('2026-07-15T12:34:56.000Z');

/** The span of each matrix range, by name. */
export const MATRIX_RANGES: Record<string, number> = {
  '5m': 5 * MINUTE,
  '1h': HOUR,
  '6h': 6 * HOUR,
  '24h': DAY,
  '2d': 2 * DAY,
  '7d': 7 * DAY,
  '10d': 10 * DAY,
  '30d': 30 * DAY,
  '90d': 90 * DAY,
  '1y': 365 * DAY,
};

/** The places of the bars, as parts of the range (0 is the left edge, 1 is the right edge). */
export const BAR_POSITIONS: Record<string, number[]> = {
  'both edges': [0, 0.25, 0.5, 0.75, 1],
  'left edge only': [0, 0.3, 0.5],
  'right edge only': [0.5, 0.7, 1],
  sparse: [0.1, 0.6],
  'single bar': [0.5],
  'gap in middle': [0, 0.1, 0.2, 0.8, 0.9, 1],
  dense: Array.from({ length: 41 }, (_, i) => i / 40),
};

export const MATRIX_TIME_ZONES = ['utc', 'America/New_York'];

/** The time range of one span that ends at `to`. */
export function matrixRange(span: number, to = TO): TimeRange {
  return { from: dateTime(to - span), to: dateTime(to), raw: { from: dateTime(to - span), to: dateTime(to) } };
}

// Ranges that cross the end of DST in New York (2026-11-01 02:00 local).
const DST_FROM = Date.parse('2026-10-30T16:00:00.000Z');
export const DST_RANGES: Record<string, TimeRange> = {
  'DST 3d': matrixRange(3 * DAY, DST_FROM + 3 * DAY),
  'DST 10d': matrixRange(10 * DAY, DST_FROM + 10 * DAY),
};

/** One frame with a value at each position of the range. */
export function matrixFrame(range: TimeRange, positions: number[]) {
  const from = range.from.valueOf();
  const span = range.to.valueOf() - from;
  return toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: positions.map((p) => Math.round(from + p * span)) },
      { name: 'v', type: FieldType.number, values: positions.map((_, i) => 5 + ((i * 7) % 11)) },
    ],
  });
}
