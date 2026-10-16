import { normalizeCanvasEvents } from 'test/canvas';
import { height, width } from 'test/panel';
import {
  booleansFrame,
  denseFrame,
  renderTimeline,
  startEndFrame,
  stringsFrame,
  thresholdsFrame,
} from 'test/timelineCanvas';
import { type PanelOptions } from 'types';

// State timeline core-parity baselines: the series layer (bars and value text) for
// each input shape and core option the timeline reads. The claims these pictures
// support are stated as code in `timeline.integration.test.tsx`.

// Commit the series layer; grid and axes are viewer-only context.
const renderBars = async (frames: Parameters<typeof renderTimeline>[0], options: Partial<PanelOptions> = {}) => {
  const { seriesEvents, defaultEvents, axisEvents } = await renderTimeline(frames, options);
  return { bars: normalizeCanvasEvents(seriesEvents), context: [...defaultEvents, ...axisEvents] };
};

describe('state timeline core parity canvas', () => {
  describe('input shapes', () => {
    it('string states with value mappings', async () => {
      const { bars, context } = await renderBars([stringsFrame()]);
      expect(bars).toMatchCanvasSnapshot(context, { width, height });
    });

    it('boolean states', async () => {
      const { bars, context } = await renderBars([booleansFrame()]);
      expect(bars).toMatchCanvasSnapshot(context, { width, height });
    });

    it('numbers merged by threshold step', async () => {
      const { bars, context } = await renderBars([thresholdsFrame()]);
      expect(bars).toMatchCanvasSnapshot(context, { width, height });
    });

    it('start and end time fields', async () => {
      const { bars, context } = await renderBars([startEndFrame()]);
      expect(bars).toMatchCanvasSnapshot(context, { width, height });
    });

    it('dense states under 1 px', async () => {
      const { bars, context } = await renderBars([denseFrame()]);
      expect(bars).toMatchCanvasSnapshot(context, { width, height });
    });
  });

  describe('value text alignment', () => {
    it('left', async () => {
      const { bars, context } = await renderBars([stringsFrame()], { alignValue: 'left' });
      expect(bars).toMatchCanvasSnapshot(context, { width, height });
    });

    it('center', async () => {
      const { bars, context } = await renderBars([stringsFrame()], { alignValue: 'center' });
      expect(bars).toMatchCanvasSnapshot(context, { width, height });
    });

    it('right', async () => {
      const { bars, context } = await renderBars([stringsFrame()], { alignValue: 'right' });
      expect(bars).toMatchCanvasSnapshot(context, { width, height });
    });
  });

  it('line width 1', async () => {
    const { bars, context } = await renderBars([stringsFrame({ lineWidth: 1 })]);
    expect(bars).toMatchCanvasSnapshot(context, { width, height });
  });

  describe('null values', () => {
    it('connect null values always', async () => {
      const { bars, context } = await renderBars([stringsFrame({ spanNulls: true })], { mergeValues: false });
      expect(bars).toMatchCanvasSnapshot(context, { width, height });
    });

    it('disconnect values over 15 minutes', async () => {
      const { bars, context } = await renderBars([stringsFrame({ insertNulls: 15 * 60 * 1000 })]);
      expect(bars).toMatchCanvasSnapshot(context, { width, height });
    });
  });
});
