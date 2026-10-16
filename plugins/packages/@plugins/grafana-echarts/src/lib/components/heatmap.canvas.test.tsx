import { normalizeCanvasEvents } from 'test/canvas';
import { denseCellsFrame, leRowsFrame, renderHeatmap } from 'test/heatmapCanvas';
import { height, width } from 'test/panel';
import { type PanelOptions } from 'types';

// Heatmap core-parity baselines: the cell layer (or the axis layer for labels)
// for each core option the binned layout reads. The claims these pictures
// support are stated as code in `heatmap.integration.test.tsx`.

// Commit the cell layer; grid and axes are viewer-only context.
const renderCells = async (frames: Parameters<typeof renderHeatmap>[0], options: Partial<PanelOptions>) => {
  const { seriesEvents, defaultEvents, axisEvents } = await renderHeatmap(frames, options);
  return { cells: normalizeCanvasEvents(seriesEvents), context: [...defaultEvents, ...axisEvents] };
};

describe('heatmap core parity canvas', () => {
  describe('le rows Y bucket scale', () => {
    it('auto (ordinal rows)', async () => {
      const { cells, context } = await renderCells([leRowsFrame], {});
      expect(cells).toMatchCanvasSnapshot(context, { width, height });
    });

    it('linear', async () => {
      const { cells, context } = await renderCells([leRowsFrame], { rowsFrame: { yBucketScale: { type: 'linear' } } });
      expect(cells).toMatchCanvasSnapshot(context, { width, height });
    });

    it('log2', async () => {
      const { cells, context } = await renderCells([leRowsFrame], {
        rowsFrame: { yBucketScale: { type: 'log', log: 2 } },
      });
      expect(cells).toMatchCanvasSnapshot(context, { width, height });
    });
  });

  describe('dense cells (calculate from data output)', () => {
    it('linear Y axis', async () => {
      const { cells, context } = await renderCells([denseCellsFrame()], {});
      expect(cells).toMatchCanvasSnapshot(context, { width, height });
    });

    it('log2 Y axis', async () => {
      const { cells, context } = await renderCells([denseCellsFrame(2)], {});
      expect(cells).toMatchCanvasSnapshot(context, { width, height });
    });
  });

  it('cell gap with hidden empty cells', async () => {
    const { cells, context } = await renderCells([leRowsFrame], { cellGap: 3, filterValues: { le: 1e-9 } });
    expect(cells).toMatchCanvasSnapshot(context, { width, height });
  });

  it('opacity mode, exponential scale, fixed color range', async () => {
    const { cells, context } = await renderCells([leRowsFrame], {
      color: { mode: 'opacity', fill: 'blue', scale: 'exponential', exponent: 0.5, min: 0, max: 12 },
    });
    expect(cells).toMatchCanvasSnapshot(context, { width, height });
  });

  it('long unit labels on the Y axis', async () => {
    const { seriesEvents, defaultEvents, axisEvents } = await renderHeatmap([leRowsFrame], {
      yAxis: { unit: 'kwatt', decimals: 1 },
    });
    // Commit the axis layer; the cells and grid are viewer-only context.
    expect(normalizeCanvasEvents(axisEvents)).toMatchCanvasSnapshot([...defaultEvents, ...seriesEvents], {
      width,
      height,
    });
  });
});
