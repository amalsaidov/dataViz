import { dateTimeForTimeZone } from '@grafana/data';
import { getXTickSpace } from 'lib/echarts/axes/xTickSpacing';

// The tick list of a time x axis (#1085). One list gives the grid lines and the labels, so each label is on a
// grid line. The function uses no ECharts API.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

interface Step {
  /** The shortest length of one step in ms. It sets the minimum pixel gap. */
  ms: number;
  /** A wall-clock step in the time zone. Not set for a fixed step in ms. */
  calendar?: { count: number; unit: 'hour' | 'day' | 'month' };
}

/** The steps, from the smallest to the largest. A month is 28 days at the shortest. */
const STEPS: Step[] = [
  ...[1, 5, 15, 30].map((n) => ({ ms: n * SECOND })),
  ...[1, 5, 15, 30].map((n) => ({ ms: n * MINUTE })),
  ...[1, 3, 6, 12].map((n) => ({ ms: n * HOUR, calendar: { count: n, unit: 'hour' as const } })),
  ...[1, 2, 7].map((n) => ({ ms: n * DAY - HOUR, calendar: { count: n, unit: 'day' as const } })),
  ...[1, 3, 12].map((n) => ({ ms: n * 28 * DAY, calendar: { count: n, unit: 'month' as const } })),
];

export interface TimeGridRange {
  from: number;
  to: number;
}

/**
 * The tick values of a time axis: the smallest step whose ticks are one label space apart (the rule of
 * `xTickSpacing.ts`). Steps of one hour or more are wall-clock steps in the dashboard time zone, so DST does
 * not move them: a 6 h step stays on 00:00, 06:00, 12:00 and 18:00. Month, quarter and year ticks are on the
 * 1st of a month. Each tick is in the range.
 * Returns no ticks when the plot width is not known.
 * `dateTimeForTimeZone` of `@grafana/data`:
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/datetime/moment_wrapper.ts
 */
export function getTimeGridTicks(
  range: TimeGridRange,
  plotWidth: number | undefined,
  labelWidth: number | undefined,
  timeZone: string,
  /** The smallest step that the label format can show, for example 1 minute for `HH:mm`. */
  minStepMs = 0
): number[] {
  const span = range.to - range.from;
  if (plotWidth == null || plotWidth <= 0 || !(span > 0)) {
    return [];
  }
  const minMs = Math.max((getXTickSpace(labelWidth) / plotWidth) * span, minStepMs);
  const step = STEPS.find(({ ms }) => ms >= minMs) ?? STEPS[STEPS.length - 1];
  const ticks = !step.calendar
    ? fixedTicks(range, step.ms, timeZone)
    : step.calendar.unit === 'hour'
      ? hourTicks(range, step.calendar.count, timeZone)
      : calendarTicks(range, step.calendar.count, step.calendar.unit, timeZone);
  // A wall-clock hour that DST skips gives the next hour twice.
  return [...new Set(ticks)].filter((tick) => tick >= range.from && tick <= range.to);
}

/** Ticks one fixed step apart, from the start of the local day of `from`. */
function fixedTicks({ from, to }: TimeGridRange, ms: number, timeZone: string): number[] {
  const dayStart = dateTimeForTimeZone(timeZone, from).startOf('day').valueOf();
  const ticks: number[] = [];
  for (let tick = dayStart + Math.ceil((from - dayStart) / ms) * ms; tick <= to; tick += ms) {
    ticks.push(tick);
  }
  return ticks;
}

/** Ticks on each local wall-clock hour that the step divides, day by day from the local day of `from`. */
function hourTicks({ from, to }: TimeGridRange, count: number, timeZone: string): number[] {
  const anchor = dateTimeForTimeZone(timeZone, from).startOf('day').valueOf();
  const ticks: number[] = [];
  for (let i = 0; ; i++) {
    const day = dateTimeForTimeZone(timeZone, anchor).add(i, 'day').valueOf();
    if (day > to) {
      return ticks;
    }
    for (let hour = 0; hour < 24; hour += count) {
      const tick = dateTimeForTimeZone(timeZone, day);
      // A wall-clock hour that DST repeats (01:00 at the end of DST) gets one tick, so that gap is 2 h.
      tick.set('hour', hour);
      ticks.push(tick.valueOf());
    }
  }
}

/** Ticks a count of local days or calendar months apart. */
function calendarTicks({ from, to }: TimeGridRange, count: number, unit: 'day' | 'month', timeZone: string): number[] {
  const start = dateTimeForTimeZone(timeZone, from).startOf(unit);
  // A week starts on the first day of the locale week. A quarter and a year start on a month that the step
  // divides (January, April, July, October).
  if (unit === 'day' && count === 7) {
    start.startOf('week');
  } else if (unit === 'month') {
    start.subtract((Number(start.format('M')) - 1) % count, 'month');
  }
  const anchor = start.valueOf();
  const ticks: number[] = [];
  for (let i = 0; ; i++) {
    // Each tick counts from the anchor, so a short month does not move the next ticks.
    const tick = dateTimeForTimeZone(timeZone, anchor)
      .add(i * count, unit)
      .valueOf();
    if (tick > to) {
      return ticks;
    }
    ticks.push(tick);
  }
}
