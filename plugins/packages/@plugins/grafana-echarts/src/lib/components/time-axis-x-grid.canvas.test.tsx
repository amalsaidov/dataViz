import { render } from '@testing-library/react';
import { normalizeCanvasEvents } from 'test/canvas';
import { getCanvasEvents, getComponent, height, width } from 'test/panel';

import { GRID_RANGES, gridBarsFrame, gridRange, gridRenderOptions } from './timeAxisGridRangesFixture';

// Canvas baselines of the x grid lines of a time axis (#1067): the bar chart of the annotations test on more
// time ranges. The grid is on the default layer. The claims are in `time-axis-x-grid.integration.test.tsx`.
describe('the x grid lines of bars on a time axis', () => {
  it.each(Object.keys(GRID_RANGES))('on a range of %s', async (name) => {
    const span = GRID_RANGES[name];
    const timeRange = gridRange(span);
    const { container } = render(
      getComponent([gridBarsFrame(span)], 'bar', gridRenderOptions, { timeRange }, { timeRange, timeZone: 'utc' })
    );
    const { defaultEvents, seriesEvents } = await getCanvasEvents(container);
    expect(normalizeCanvasEvents(defaultEvents)).toMatchCanvasSnapshot(seriesEvents, { width, height });
  });
});
