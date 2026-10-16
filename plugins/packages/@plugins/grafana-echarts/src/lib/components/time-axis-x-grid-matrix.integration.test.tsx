import { dateTimeForTimeZone, type TimeRange } from '@grafana/data';
import { render } from '@testing-library/react';
import { type BarCanvasEvent } from 'test/barCanvas';
import { getCanvasEvents, getComponent } from 'test/panel';
import { gridGaps, readGrid, type XGrid } from 'test/xGrid';

import { gridRenderOptions } from './timeAxisGridRangesFixture';
import {
  BAR_POSITIONS,
  DST_RANGES,
  MATRIX_RANGES,
  MATRIX_TIME_ZONES,
  matrixFrame,
  matrixRange,
} from './xGridMatrixFixture';

// The x grid matrix of a time axis (#1087): range x bar position x time zone. The grid is even, each label is
// on a grid line, the grid fills the plot, and bars have the grid of lines on the same range.
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;
// ECharts draws each grid line on a half pixel, so a line can move by up to 0.5 px (`subPixelOptimize`).
// Two lines can then differ by 1 px. https://echarts.apache.org/en/option.html#xAxis.splitLine
const PX = 1;

const renderGrid = async (range: TimeRange, timeZone: string, seriesType: 'bar' | 'line', positions: number[]) => {
  const { container, unmount } = render(
    getComponent(
      [matrixFrame(range, positions)],
      seriesType,
      gridRenderOptions,
      { timeRange: range },
      {
        timeRange: range,
        timeZone,
      }
    )
  );
  const grid = readGrid((await getCanvasEvents(container)).defaultEvents as BarCanvasEvent[]);
  unmount();
  return grid;
};

/** The time of each grid line, from its x on the plot of the range. */
const lineTimes = ({ xs, left, right }: XGrid, range: TimeRange) => {
  const from = range.from.valueOf();
  const msPerPx = (range.to.valueOf() - from) / (right - left);
  return { times: xs.map((x) => from + (x - left) * msPerPx), msPerPx };
};

/** The nearest start of a local `unit` (hour, day or month) to `t`. */
const nearestStart = (t: number, unit: 'hour' | 'day' | 'month', timeZone: string) => {
  const start = dateTimeForTimeZone(timeZone, t).startOf(unit);
  const next = dateTimeForTimeZone(timeZone, start.valueOf()).add(1, unit);
  return Math.abs(t - start.valueOf()) < Math.abs(next.valueOf() - t) ? start : next;
};

/**
 * Steps of an hour or more are wall-clock steps in the time zone. Each line is on a local hour that the step
 * divides, on a local midnight, or on the 1st of a month. Day and month lines are an equal count apart.
 */
const expectCalendarSteps = (grid: XGrid, range: TimeRange, timeZone: string) => {
  const { times, msPerPx } = lineTimes(grid, range);
  const gap = Math.min(...times.slice(1).map((t, i) => t - times[i]));
  const unit = gap > 27 * DAY ? 'month' : gap > 22 * HOUR ? 'day' : 'hour';
  const starts = times.map((t) => {
    const start = nearestStart(t, unit, timeZone);
    expect(Math.abs(t - start.valueOf())).toBeLessThanOrEqual(msPerPx * PX);
    return start;
  });
  if (unit === 'hour') {
    const hours = Math.round(gap / HOUR);
    starts.forEach((start) => expect(Number(start.format('H')) % hours).toBe(0));
    return;
  }
  const steps = starts.slice(1).map((start, i) => Math.round(start.diff(starts[i], unit, true)));
  steps.forEach((step) => expect(step).toBe(steps[0]));
};

const expectXGrid = (grid: XGrid, range: TimeRange, timeZone: string) => {
  const { xs, left, right, labels } = grid;
  const gaps = gridGaps(xs);
  expect(gaps.length).toBeGreaterThan(1);
  const { times } = lineTimes(grid, range);
  if (times[1] - times[0] < 50 * 60 * 1000) {
    gaps.forEach((gap) => expect(Math.abs(gap - gaps[0])).toBeLessThanOrEqual(PX));
  } else {
    expectCalendarSteps(grid, range, timeZone);
  }
  const step = Math.max(...gaps);
  expect(xs[0] - left).toBeLessThanOrEqual(step + PX);
  expect(right - xs[xs.length - 1]).toBeLessThanOrEqual(step + PX);
  expect(labels.length).toBeGreaterThan(0);
  labels.forEach(({ x }) => expect(xs.some((line) => Math.abs(line - x) <= PX)).toBe(true));
};

const RANGES: Array<[string, TimeRange]> = [
  ...Object.entries(MATRIX_RANGES).map(([name, span]): [string, TimeRange] => [name, matrixRange(span)]),
  ...Object.entries(DST_RANGES),
];

const CASES = RANGES.flatMap(([name, range]) =>
  MATRIX_TIME_ZONES.filter((timeZone) => !name.startsWith('DST') || timeZone !== 'utc').flatMap((timeZone) =>
    Object.keys(BAR_POSITIONS).map((bars) => ({ name, range, timeZone, bars }))
  )
);

describe('the x grid matrix of a time axis', () => {
  it.each(RANGES.flatMap(([name, range]) => MATRIX_TIME_ZONES.map((timeZone) => ({ name, range, timeZone }))))(
    'of lines on $name in $timeZone is even and has each label on a line',
    async ({ range, timeZone }) => {
      expectXGrid(await renderGrid(range, timeZone, 'line', BAR_POSITIONS.dense), range, timeZone);
    }
  );

  it.each(CASES)(
    'of bars on $name in $timeZone, $bars, is even and has each label on a line',
    async ({ range, timeZone, bars }) => {
      expectXGrid(await renderGrid(range, timeZone, 'bar', BAR_POSITIONS[bars]), range, timeZone);
    }
  );

  // A single bar starts its y axis at 0 and a single point does not, so the plot widths can differ. Thus the
  // grids are compared as times on the axis.
  it.each(CASES)(
    'of bars on $name in $timeZone, $bars, equals the grid of lines',
    async ({ range, timeZone, bars }) => {
      const bar = lineTimes(await renderGrid(range, timeZone, 'bar', BAR_POSITIONS[bars]), range);
      const line = lineTimes(await renderGrid(range, timeZone, 'line', BAR_POSITIONS[bars]), range);
      // 3 lines or more, so the claim does not pass on an empty grid.
      expect(line.times.length).toBeGreaterThan(2);
      expect(bar.times.length).toBe(line.times.length);
      bar.times.forEach((t, i) => expect(Math.abs(t - line.times[i])).toBeLessThanOrEqual(bar.msPerPx * PX));
    }
  );

  // A tick on a range end hides its label, so a label does not make ECharts shrink the plot.
  it.each(Object.entries(MATRIX_RANGES))('keeps the plot edges of %s when the range moves', async (_, span) => {
    const onHour = matrixRange(span, Date.parse('2026-07-15T11:00:00.000Z'));
    const offHour = matrixRange(span, Date.parse('2026-07-15T11:07:00.000Z'));
    const a = await renderGrid(onHour, 'utc', 'line', BAR_POSITIONS.dense);
    const b = await renderGrid(offHour, 'utc', 'line', BAR_POSITIONS.dense);
    expect(a.left).toBeCloseTo(b.left, 0);
    expect(a.right).toBeCloseTo(b.right, 0);
  });
});
