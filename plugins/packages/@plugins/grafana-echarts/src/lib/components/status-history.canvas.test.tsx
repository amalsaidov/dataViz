import { normalizeCanvasEvents } from 'test/canvas';
import { height, width } from 'test/panel';
import { renderStatusHistory, statusGridFrame, stringsFrame } from 'test/timelineCanvas';
import { type PanelOptions } from 'types';

// Status history core-parity baselines: the series layer (cells and value text) of
// core's Samples mode. The claims these pictures support are stated as code in
// `status-history.integration.test.tsx`.

// Commit the series layer; grid and axes are viewer-only context.
const renderCells = async (frames: Parameters<typeof renderStatusHistory>[0], options: Partial<PanelOptions> = {}) => {
  const { seriesEvents, defaultEvents, axisEvents } = await renderStatusHistory(frames, options);
  return { cells: normalizeCanvasEvents(seriesEvents), context: [...defaultEvents, ...axisEvents] };
};

describe('status history core parity canvas', () => {
  it('status grid of numbers in threshold colours', async () => {
    const { cells, context } = await renderCells([statusGridFrame()]);
    expect(cells).toMatchCanvasSnapshot(context, { width, height });
  });

  it('string states with value mappings', async () => {
    const { cells, context } = await renderCells([stringsFrame({ lineWidth: 1 })]);
    expect(cells).toMatchCanvasSnapshot(context, { width, height });
  });

  it('column width 0.5', async () => {
    const { cells, context } = await renderCells([statusGridFrame()], { colWidth: 0.5 });
    expect(cells).toMatchCanvasSnapshot(context, { width, height });
  });
});
