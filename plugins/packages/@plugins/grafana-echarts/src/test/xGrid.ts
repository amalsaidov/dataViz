import { type BarCanvasEvent, drawnTexts } from 'test/barCanvas';

// Readers of the x grid of a time axis in recorded draw calls (#1087). The grid lines and the x labels must be
// on the same layer: render with `zLevel.series` only, so the axis paints on the default layer.

export interface Line {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

/** Each straight line: a `moveTo` and the next `lineTo`, in canvas space. */
export const lines = (events: BarCanvasEvent[]): Line[] =>
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

export interface XGrid {
  /** The x of each vertical grid line, sorted. */
  xs: number[];
  /** The left and right plot edges: the ends of the horizontal grid lines. */
  left: number;
  right: number;
  /** The x labels under the plot, in draw order. */
  labels: Array<{ text: string; x: number }>;
}

/** The x grid of one render: the vertical grid lines, the plot edges and the x labels. */
export const readGrid = (events: BarCanvasEvent[]): XGrid => {
  const all = lines(events);
  const vertical = all.filter(({ x1, x2, y1, y2 }) => Math.abs(x1 - x2) < 0.01 && Math.abs(y1 - y2) > 20);
  const horizontal = all.filter(({ x1, x2, y1, y2 }) => Math.abs(y1 - y2) < 0.01 && Math.abs(x1 - x2) > 20);
  const xs = [...new Set(vertical.map(({ x1 }) => Math.round(x1 * 10) / 10))].sort((a, b) => a - b);
  const bottom = Math.max(...vertical.map(({ y1, y2 }) => Math.max(y1, y2)));
  return {
    xs,
    left: Math.min(...horizontal.map(({ x1, x2 }) => Math.min(x1, x2))),
    right: Math.max(...horizontal.map(({ x1, x2 }) => Math.max(x1, x2))),
    // The x labels are under the lowest grid line.
    labels: drawnTexts(events)
      .filter(({ y }) => y > bottom)
      .map(({ text, x }) => ({ text, x })),
  };
};

/** The gaps between neighbouring grid lines. */
export const gridGaps = (xs: number[]): number[] => xs.slice(1).map((x, i) => x - xs[i]);
