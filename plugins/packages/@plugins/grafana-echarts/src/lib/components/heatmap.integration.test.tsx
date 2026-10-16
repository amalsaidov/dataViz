import { cellHeights, cellRects, denseCellsFrame, largestCell, leRowsFrame, renderHeatmap } from 'test/heatmapCanvas';

// Heatmap core-parity claims, stated as counts and as differences between two
// renders. No baselines here: the drawn geometry is pinned next door in
// `heatmap.canvas.test.tsx`. See `test/heatmapCanvas.tsx` for the fixtures.

describe('heatmap Y bucket scale for le rows', () => {
  it('draws every le bucket at the same height by default (core "Auto")', async () => {
    const { seriesEvents } = await renderHeatmap([leRowsFrame]);
    expect(cellHeights(cellRects(seriesEvents))).toHaveLength(1);
  });

  it('draws exponential le buckets at different heights on a linear scale', async () => {
    const { seriesEvents } = await renderHeatmap([leRowsFrame], { rowsFrame: { yBucketScale: { type: 'linear' } } });
    expect(cellHeights(cellRects(seriesEvents)).length).toBeGreaterThan(1);
  });

  it('draws buckets that grow by a constant ratio at one height on a log scale', async () => {
    // Bounds 1, 4, 16 and +Inf grow by 4 each: one height on a log axis.
    const { seriesEvents } = await renderHeatmap([leRowsFrame], {
      rowsFrame: { yBucketScale: { type: 'log', log: 2 } },
    });
    expect(cellHeights(cellRects(seriesEvents))).toHaveLength(1);
  });
});

describe('heatmap dense cells (calculate from data output)', () => {
  it('draws doubling buckets at growing heights on a linear axis', async () => {
    const { seriesEvents } = await renderHeatmap([denseCellsFrame()]);
    expect(cellHeights(cellRects(seriesEvents)).length).toBeGreaterThan(1);
  });

  it('draws doubling buckets at one height on a log2 axis', async () => {
    const { seriesEvents } = await renderHeatmap([denseCellsFrame(2)]);
    expect(cellHeights(cellRects(seriesEvents))).toHaveLength(1);
  });
});

describe('heatmap cell display', () => {
  it('leaves out cells at or below filterValues.le', async () => {
    const all = cellRects((await renderHeatmap([leRowsFrame])).seriesEvents);
    const kept = cellRects((await renderHeatmap([leRowsFrame], { filterValues: { le: 1e-9 } })).seriesEvents);
    // The fixture has three empty cells.
    expect(all.length - kept.length).toBe(3);
  });

  it('keeps the Y range of every bucket when cells are hidden', async () => {
    const all = cellRects((await renderHeatmap([leRowsFrame])).seriesEvents);
    const kept = cellRects((await renderHeatmap([leRowsFrame], { filterValues: { le: 1e-9 } })).seriesEvents);
    const span = (rects: typeof all) => [
      Math.min(...rects.map((r) => r.y)),
      Math.max(...rects.map((r) => r.y + r.height)),
    ];
    expect(span(kept)).toEqual(span(all));
  });

  it('shrinks each cell by cellGap', async () => {
    const flush = largestCell(cellRects((await renderHeatmap([leRowsFrame], { cellGap: 0 })).seriesEvents));
    const gapped = largestCell(cellRects((await renderHeatmap([leRowsFrame], { cellGap: 3 })).seriesEvents));
    // No gap adds 0.5 px to close seams; a gap removes its size.
    expect(flush.width - gapped.width).toBeCloseTo(3.5);
    expect(flush.height - gapped.height).toBeCloseTo(3.5);
  });
});

describe('heatmap colors', () => {
  const alpha = (fill?: string) => Number(/rgba\([^)]*,\s*([\d.]+)\)/.exec(fill ?? '')?.[1] ?? 1);

  it('fades the fill from clear to solid in opacity mode', async () => {
    const rects = cellRects(
      (await renderHeatmap([leRowsFrame], { color: { mode: 'opacity', fill: 'blue', scale: 'linear' } })).seriesEvents
    );
    const alphas = rects.map((rect) => alpha(rect.fillStyle));
    expect(Math.min(...alphas)).toBeLessThan(0.05);
    expect(Math.max(...alphas)).toBeGreaterThan(0.95);
  });

  it('keeps low values more visible with the exponential scale', async () => {
    const opts = (scale: 'linear' | 'exponential') => ({ color: { mode: 'opacity' as const, fill: 'blue', scale } });
    const mean = (rects: ReturnType<typeof cellRects>) =>
      rects.reduce((sum, rect) => sum + alpha(rect.fillStyle), 0) / rects.length;
    const linear = cellRects((await renderHeatmap([leRowsFrame], opts('linear'))).seriesEvents);
    const exponential = cellRects((await renderHeatmap([leRowsFrame], opts('exponential'))).seriesEvents);
    expect(mean(exponential)).toBeGreaterThan(mean(linear));
  });

  it('maps colors against color.min and color.max instead of the data range', async () => {
    const fills = async (color?: { min?: number; max?: number }) =>
      cellRects((await renderHeatmap([leRowsFrame], { color: { mode: 'scheme', ...color } })).seriesEvents).map(
        (rect) => rect.fillStyle
      );
    // A max far above the data squeezes every cell into the low end of the scale.
    const wide = new Set(await fills({ min: 0, max: 1000 }));
    const data = new Set(await fills());
    expect(wide.size).toBeLessThan(data.size);
  });
});

describe('heatmap Y label width', () => {
  it('moves the cells right to fit a long unit label', async () => {
    const left = async (unit?: string) =>
      Math.min(
        ...cellRects((await renderHeatmap([leRowsFrame], { yAxis: { unit, decimals: 1 } })).seriesEvents).map(
          (r) => r.x
        )
      );
    // "16.0 kW" is wider than "16.0"; `grid.containLabel` must reserve that room.
    expect(await left('kwatt')).toBeGreaterThan(await left());
  });
});
