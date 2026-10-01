// The x grid lines of a time axis (#1058). Core (uPlot) draws its grid lines at the tick splits, one fixed step
// apart, so the grid is even from one plot edge to the other. The tick labels are those of main (#1012, #1022).
// The test reads the drawn grid lines and time labels of each render.
import { render } from '@testing-library/react';
import { timeseriesAdapter } from 'standalone/importAdapters/timeseries';
import { type BarCanvasEvent, drawnTexts, renderBars, timeFrame } from 'test/barCanvas';
import { AXIS_ZLEVEL, SERIES_ZLEVEL } from 'test/canvas';
import { getAxisCanvasEvents, getComponent } from 'test/panel';
import type { PanelOptions } from 'types';

import { multiWeekFrame, multiWeekRange } from './utcTimeAxisFixture';

interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Each straight line: a `moveTo` and the next `lineTo`, in canvas space. */
const lines = (events: BarCanvasEvent[]): Line[] =>
  events.flatMap((event, i) => {
    const next = events[i + 1];
    if (event.type !== 'moveTo' || next?.type !== 'lineTo') {
      return [];
    }
    const [, , , , tx = 0, ty = 0] = event.transform ?? [];
    const { x, y } = event.props as { x: number; y: number };
    const end = next.props as { x: number; y: number };
    return [{ x1: x + tx, y1: y + ty, x2: end.x + tx, y2: end.y + ty }];
  });

/** The grid of one render: the x of each vertical grid line, the plot edges and the time labels. */
const readGrid = (grid: BarCanvasEvent[]) => {
  const all = lines(grid);
  const vertical = all.filter(({ x1, x2, y1, y2 }) => Math.abs(x1 - x2) < 0.01 && y1 !== y2);
  // The horizontal grid lines go from one plot edge to the other.
  const horizontal = all.filter(({ x1, x2, y1, y2 }) => Math.abs(y1 - y2) < 0.01 && x1 !== x2);
  const xs = [...new Set(vertical.map(({ x1 }) => Math.round(x1 * 10) / 10))].sort((a, b) => a - b);
  return {
    xs,
    left: Math.min(...horizontal.map(({ x1, x2 }) => Math.min(x1, x2))),
    right: Math.max(...horizontal.map(({ x1, x2 }) => Math.max(x1, x2))),
    labels: drawnTexts(grid)
      .filter(({ text }) => /^\d\d[:/]\d\d$/.test(text))
      .map(({ text, x }) => ({ text, x })),
  };
};

/** The claims of core on one grid, and the labels of main. */
const expectCoreXGrid = (grid: BarCanvasEvent[], mainLabels: string[]) => {
  const { xs, left, right, labels } = readGrid(grid);
  const gaps = xs.slice(1).map((x, i) => x - xs[i]);
  const step = gaps[0];

  expect(labels.map(({ text }) => text)).toEqual(mainLabels);
  expect(gaps.length).toBeGreaterThan(1);
  // The grid lines are evenly spaced.
  gaps.forEach((gap) => expect(Math.abs(gap - step)).toBeLessThanOrEqual(1));
  // No gap is larger than one step, also at the plot edges.
  expect(xs[0] - left).toBeLessThanOrEqual(step + 1);
  expect(right - xs[xs.length - 1]).toBeLessThanOrEqual(step + 1);
  // Each shown label is on a grid line.
  labels.forEach(({ x }) => expect(xs.some((line) => Math.abs(line - x) <= 1)).toBe(true));
};

/** The drawn labels of each render on main (0061106), in draw order. A grid change must not change them. */
const MAIN_LABELS: Record<string, string[]> = {
  importedBars: ['06:40', '04:00', '05:00', '06:00'],
  defaultRangeBars: ['04:20', '05:20', '06:20'],
  utc: ['08/05', '08/09', '08/13', '08/17', '08/21'],
  'America/New_York': ['08/04', '08/08', '08/12', '08/16', '08/20'],
};

const importedBars = () =>
  timeseriesAdapter.translate(
    { type: 'timeseries', fieldConfig: { defaults: { custom: { drawStyle: 'bars' } }, overrides: [] } },
    {}
  ).options as Partial<PanelOptions>;

describe('the x grid lines of a time axis', () => {
  it('are even across the plot of imported Time series bars, as core', async () => {
    const frame = timeFrame(
      'A',
      Array.from({ length: 12 }, (_, i) => i / 4),
      Array.from({ length: 12 }, (_, i) => 100 + ((i * 7) % 21))
    );
    expectCoreXGrid((await renderBars([frame], importedBars())).grid, MAIN_LABELS.importedBars);
  });

  it('are even across the plot of bars on the default time range, as core', async () => {
    const frame = timeFrame('A', [0, 1, 2, 3], [1, 3, 2, 4]);
    expectCoreXGrid((await renderBars([frame], { barWidth: 60 })).grid, MAIN_LABELS.defaultRangeBars);
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
      expectCoreXGrid((await getAxisCanvasEvents(container)).defaultEvents as BarCanvasEvent[], MAIN_LABELS[timeZone]);
    }
  );
});
