import { dateTimeForTimeZone } from '@grafana/data';
import { getTimeGridTicks } from 'lib/echarts/axes/timeGridTicks';
import { getXTickSpace } from 'lib/echarts/axes/xTickSpacing';

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const TO = Date.UTC(2026, 6, 15, 12, 34, 56);
const LABEL_WIDTH = 40;
// The end of DST in New York is 2026-11-01 02:00 local.
const DST_TO = Date.UTC(2026, 10, 3, 16);
const DST_DAY_TO = Date.UTC(2026, 10, 1, 18);

interface Row {
  name: string;
  from: number;
  to: number;
  width: number;
  timeZone: string;
  /** The expected step: ms for a fixed step, or a count of local days or months. */
  step: number | { hours: number } | { days: number } | { months: number };
}

const row = (name: string, span: number, width: number, timeZone: string, step: Row['step'], to = TO): Row => ({
  name,
  from: to - span,
  to,
  width,
  timeZone,
  step,
});

const ROWS: Row[] = [
  row('5m', 5 * MINUTE, 400, 'utc', MINUTE),
  row('1h', HOUR, 400, 'utc', 15 * MINUTE),
  row('1h wide', HOUR, 1200, 'utc', 5 * MINUTE),
  row('6h', 6 * HOUR, 400, 'America/New_York', { hours: 1 }),
  row('24h', DAY, 400, 'utc', { hours: 6 }),
  row('2d', 2 * DAY, 400, 'America/New_York', { hours: 12 }),
  row('2d browser', 2 * DAY, 400, 'browser', { hours: 12 }),
  row('7d', 7 * DAY, 800, 'utc', { days: 1 }),
  row('10d', 10 * DAY, 400, 'America/New_York', { days: 2 }),
  row('30d', 30 * DAY, 400, 'utc', { days: 7 }),
  row('90d', 90 * DAY, 400, 'America/New_York', { months: 1 }),
  row('1y', 365 * DAY, 400, 'utc', { months: 3 }),
  row('5y', 5 * 365 * DAY, 400, 'utc', { months: 12 }),
  row('DST 3d', 3 * DAY, 400, 'America/New_York', { hours: 12 }, DST_TO),
  row('DST 1d', DAY, 400, 'America/New_York', { hours: 6 }, DST_DAY_TO),
  row('DST 10d', 10 * DAY, 400, 'America/New_York', { days: 2 }, DST_TO),
];

describe('getTimeGridTicks', () => {
  it.each(ROWS)('gives the ticks of $name at $width px in $timeZone', ({ from, to, width, timeZone, step }) => {
    const ticks = getTimeGridTicks({ from, to }, width, LABEL_WIDTH, timeZone);
    expect(ticks.length).toBeGreaterThan(1);
    // All ticks are in the range.
    ticks.forEach((tick) => expect(tick >= from && tick <= to).toBe(true));
    // Each tick is one label space or more from the next tick.
    const pxPerMs = width / (to - from);
    ticks
      .slice(1)
      .forEach((tick, i) => expect((tick - ticks[i]) * pxPerMs).toBeGreaterThanOrEqual(getXTickSpace(LABEL_WIDTH)));

    if (typeof step === 'number') {
      ticks.slice(1).forEach((tick, i) => expect(tick - ticks[i]).toBe(step));
      return;
    }
    const local = ticks.map((tick) => dateTimeForTimeZone(timeZone, tick));
    if ('hours' in step) {
      // Wall-clock steps: each tick is on a local hour that the step divides, also over the end of DST.
      local.forEach((tick) => {
        expect(tick.format('mm:ss')).toBe('00:00');
        expect(Number(tick.format('H')) % step.hours).toBe(0);
      });
      return;
    }
    // Calendar steps: each tick is on a local midnight (or the 1st of a month), a count of days or months apart.
    local.forEach((tick) => expect(tick.format('HH:mm')).toBe('00:00'));
    const months = 'months' in step;
    if (months) {
      local.forEach((tick) => expect(tick.format('D')).toBe('1'));
    }
    local.slice(1).forEach((tick, i) => {
      expect(tick.diff(local[i], months ? 'months' : 'days')).toBe(months ? step.months : step.days);
    });
  });

  it('keeps day steps on local midnight over the end of DST', () => {
    const ticks = getTimeGridTicks({ from: DST_TO - 10 * DAY, to: DST_TO }, 400, LABEL_WIDTH, 'America/New_York');
    const gaps = new Set(ticks.slice(1).map((tick, i) => tick - ticks[i]));
    // One gap has the extra hour of the end of DST.
    expect(gaps).toEqual(new Set([2 * DAY, 2 * DAY + HOUR]));
  });

  it('gives no ticks when the plot width is not known', () => {
    expect(getTimeGridTicks({ from: 0, to: DAY }, undefined, LABEL_WIDTH, 'utc')).toEqual([]);
  });

  it('gives no ticks for a range of zero width', () => {
    expect(getTimeGridTicks({ from: DAY, to: DAY }, 400, LABEL_WIDTH, 'utc')).toEqual([]);
  });

  it('uses the default tick space when the label width is not known', () => {
    const ticks = getTimeGridTicks({ from: TO - 6 * HOUR, to: TO }, 400, undefined, 'utc');
    const pxPerMs = 400 / (6 * HOUR);
    ticks
      .slice(1)
      .forEach((tick, i) => expect((tick - ticks[i]) * pxPerMs).toBeGreaterThanOrEqual(getXTickSpace(undefined)));
  });

  it('gives the repeated 01:00 of the end of DST one tick with a 1 h step', () => {
    // The local day of 2026-11-01 in New York has 25 h.
    const from = Date.UTC(2026, 10, 1, 4);
    const ticks = getTimeGridTicks({ from, to: from + 25 * HOUR }, 1500, LABEL_WIDTH, 'America/New_York');
    const gaps = ticks.slice(1).map((tick, i) => tick - ticks[i]);
    expect(gaps.filter((gap) => gap === 2 * HOUR)).toHaveLength(1);
    expect(gaps.filter((gap) => gap !== HOUR && gap !== 2 * HOUR)).toEqual([]);
  });

  it('keeps 12 h and 6 h steps on local hours over the end of DST', () => {
    const twelve = getTimeGridTicks({ from: DST_TO - 3 * DAY, to: DST_TO }, 400, LABEL_WIDTH, 'America/New_York');
    expect(new Set(twelve.slice(1).map((tick, i) => tick - twelve[i]))).toEqual(new Set([12 * HOUR, 13 * HOUR]));
    const six = getTimeGridTicks({ from: DST_DAY_TO - DAY, to: DST_DAY_TO }, 400, LABEL_WIDTH, 'America/New_York');
    expect(new Set(six.slice(1).map((tick, i) => tick - six[i]))).toEqual(new Set([6 * HOUR, 7 * HOUR]));
  });
});
