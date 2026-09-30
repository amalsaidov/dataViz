import { render } from '@testing-library/react';
import { AXIS_ZLEVEL, normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getAxisCanvasEvents, getComponent, height, width } from 'test/panel';
import { multiWeekFrame, multiWeekRange } from './utcTimeAxisFixture';

// Baselines of the grid layer, which holds the x-axis labels, of a 3-week time series (#770). Each tick shows a date.
describe('Panel canvas multi-week time axis', () => {
  it.each(['utc', 'America/New_York'])('%s', async (timeZone) => {
    const { container } = render(
      getComponent(
        [multiWeekFrame],
        'line',
        { zLevel: { series: SERIES_ZLEVEL, axis: AXIS_ZLEVEL }, animation: { enabled: false } },
        { timeRange: multiWeekRange },
        { timeZone, timeRange: multiWeekRange }
      )
    );

    const { defaultEvents, seriesEvents } = await getAxisCanvasEvents(container);

    expect(normalizeCanvasEvents(defaultEvents)).toMatchCanvasSnapshot(seriesEvents, { width, height });
  });
});
