import path from 'node:path';
import { panTimeRange } from './timePan';

// Core `calculatePanRange` is `@internal` and not in the exports of `@grafana/ui`, so the test loads its file.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/plugins/XAxisInteractionAreaPlugin.tsx
const { calculatePanRange } = require(
  path.join(path.dirname(require.resolve('@grafana/ui')), 'components/uPlot/plugins/XAxisInteractionAreaPlugin.cjs')
);

// Viz contract 26.1: the pan gives the same range as core `calculatePanRange` of `@grafana/ui`.
describe('panTimeRange', () => {
  const range = { from: 1_000_000, to: 1_600_000 };
  const plotWidth = 600;
  const perPixel = (range.to - range.from) / plotWidth;

  it.each([100, -100, 3, -250])('gives the range of core for a drag of %d px', (dragPixels) => {
    expect(panTimeRange(range, dragPixels, perPixel)).toEqual(
      calculatePanRange(range.from, range.to, dragPixels, plotWidth)
    );
  });

  it('keeps the width, and a drag to the right shows earlier time', () => {
    const next = panTimeRange(range, 100, perPixel);
    expect(next.to - next.from).toBe(range.to - range.from);
    expect(next.from).toBeLessThan(range.from);
  });
});
