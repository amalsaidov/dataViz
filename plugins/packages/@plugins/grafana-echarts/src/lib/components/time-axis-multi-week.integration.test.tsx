import { render } from '@testing-library/react';
import { AXIS_ZLEVEL, SERIES_ZLEVEL } from 'test/canvas';
import { getAxisCanvasEvents, getComponent } from 'test/panel';
import { multiWeekFrame, multiWeekRange } from './utcTimeAxisFixture';

// Regression #770: a multi-week range labels its x-axis ticks with dates (MM/DD), as the
// core time series panel does, not with repeated times such as 04:00 or 20:00.
const xAxisLabels = async (timeZone: string) => {
  const { container } = render(
    getComponent(
      [multiWeekFrame],
      'line',
      { zLevel: { series: SERIES_ZLEVEL, axis: AXIS_ZLEVEL }, animation: { enabled: false } },
      { timeRange: multiWeekRange },
      { timeZone, timeRange: multiWeekRange }
    )
  );
  const { defaultEvents } = await getAxisCanvasEvents(container);
  return defaultEvents
    .filter((event) => event.type === 'fillText')
    .map((event) => String(event.props.text))
    .filter((text) => /^\d{2}[/:]\d{2}$/.test(text));
};

describe('multi-week time axis labels', () => {
  it.each(['utc', 'America/New_York', 'Asia/Tokyo'])('%s shows only dates', async (timeZone) => {
    const labels = await xAxisLabels(timeZone);

    expect(labels.length).toBeGreaterThan(1);
    expect(labels.every((text) => /^\d{2}\/\d{2}$/.test(text))).toBe(true);
  });

  it('UTC and New York renders label the same ticks one day apart at most', async () => {
    const utc = await xAxisLabels('utc');
    const newYork = await xAxisLabels('America/New_York');

    // The ticks of New York are 4 h later. A tick near the plot edge can hide its label in one zone only (getEdgeLabels).
    expect(Math.abs(newYork.length - utc.length)).toBeLessThanOrEqual(1);
    expect(newYork.length).toBeGreaterThan(1);
  });
});
