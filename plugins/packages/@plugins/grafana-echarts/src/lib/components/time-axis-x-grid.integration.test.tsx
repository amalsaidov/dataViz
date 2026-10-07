// The x grid lines of a time axis (#1058, #1085). One tick list gives the grid lines and the labels, so the grid
// is even from one plot edge to the other and each label is on a grid line. The test reads the drawn grid lines
// and time labels of each render. `time-axis-x-grid-matrix.integration.test.tsx` has the full matrix.
import { render } from '@testing-library/react';
import { type BarCanvasEvent, renderBars, timeFrame } from 'test/barCanvas';
import { AXIS_ZLEVEL, SERIES_ZLEVEL } from 'test/canvas';
import { getAxisCanvasEvents, getCanvasEvents, getComponent } from 'test/panel';
import type { PanelOptions } from 'types';
import { readGrid } from 'test/xGrid';

import {
  dailyFrame,
  dailyRange,
  GRID_RANGES,
  gridBarsFrame,
  gridRange,
  gridRenderOptions,
} from './timeAxisGridRangesFixture';
import { multiWeekFrame, multiWeekRange } from './utcTimeAxisFixture';

/** The gaps between the grid lines are one step, also at the plot edges if `edges` is set. */
const expectEvenXGrid = (grid: BarCanvasEvent[], edges: boolean) => {
  const { xs, left, right } = readGrid(grid);
  const gaps = xs.slice(1).map((x, i) => x - xs[i]);
  const step = gaps[0];
  expect(gaps.length).toBeGreaterThan(1);
  gaps.forEach((gap) => expect(Math.abs(gap - step)).toBeLessThanOrEqual(1));
  if (edges) {
    expect(xs[0] - left).toBeLessThanOrEqual(step + 1);
    expect(right - xs[xs.length - 1]).toBeLessThanOrEqual(step + 1);
  }
};

/** The grid is even, it fills the plot, and each shown label is on a grid line. */
const expectCoreXGrid = (grid: BarCanvasEvent[]) => {
  const { xs, labels } = readGrid(grid);
  expectEvenXGrid(grid, true);
  expect(labels.length).toBeGreaterThan(1);
  labels.forEach(({ x }) => expect(xs.some((line) => Math.abs(line - x) <= 1)).toBe(true));
};

describe('the x grid lines of a time axis', () => {
  it('are even across the plot of bars on the default time range, as core', async () => {
    const frame = timeFrame('A', [0, 1, 2, 3], [1, 3, 2, 4]);
    expectCoreXGrid((await renderBars([frame], { barWidth: 60 })).grid);
  });

  it.each(['utc', 'America/New_York'])(
    'are even across the plot of a multi-week range in %s, as core',
    async (timeZone) => {
      const { container } = render(
        getComponent(
          [multiWeekFrame],
          'line',
          { zLevel: { series: SERIES_ZLEVEL, axis: AXIS_ZLEVEL }, animation: { enabled: false } },
          { timeRange: multiWeekRange },
          { timeZone, timeRange: multiWeekRange }
        )
      );
      expectCoreXGrid((await getAxisCanvasEvents(container)).defaultEvents as BarCanvasEvent[]);
    }
  );

  // #1067: ECharts starts its day steps again at each month, so the gaps were 7, 2 and 3 days.
  it.each(['utc', 'America/New_York'])(
    'are one step apart on a range of 3 months with daily bars in %s, as core',
    async (timeZone) => {
      const timeRange = dailyRange;
      const { container } = render(
        getComponent([dailyFrame], 'bar', gridRenderOptions, { timeRange }, { timeRange, timeZone })
      );
      expectEvenXGrid((await getCanvasEvents(container)).defaultEvents as BarCanvasEvent[], true);
    }
  );

  // The ranges of `time-axis-x-grid.canvas.test.tsx`. The axis is the time range, so the edge gaps are checked.
  // A month step is a calendar step, so its gaps are not equal: the matrix checks it.
  it.each(Object.keys(GRID_RANGES).filter((name) => GRID_RANGES[name] < 30 * 24 * 60 * 60 * 1000))(
    'are one step apart on the bars of a range of %s',
    async (name) => {
      const span = GRID_RANGES[name];
      const timeRange = gridRange(span);
      const { container } = render(
        getComponent([gridBarsFrame(span)], 'bar', gridRenderOptions, { timeRange }, { timeRange, timeZone: 'utc' })
      );
      expectEvenXGrid((await getCanvasEvents(container)).defaultEvents as BarCanvasEvent[], true);
    }
  );
});
