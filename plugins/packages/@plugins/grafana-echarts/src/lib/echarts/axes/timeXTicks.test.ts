import { dateTime, type TimeRange } from '@grafana/data';
import { getEdgeLabels, getTimeXTicks } from 'lib/echarts/axes/timeXTicks';

const range = (fromMs: number, toMs: number): TimeRange => {
  const from = dateTime(fromMs);
  const to = dateTime(toMs);
  return { from, to, raw: { from, to } };
};
const sixHours = range(Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 1, 6));

describe('getTimeXTicks', () => {
  it('formats the labels in the dashboard time zone and hides labels that overlap', () => {
    const ticks = getTimeXTicks(sixHours, 'utc', undefined);
    expect(ticks.axisLabel.hideOverlap).toBe(true);
    expect(ticks.axisLabel.formatter(Date.UTC(2026, 0, 1, 3))).toBe('03:00');
  });

  it('lets ECharts place the ticks before the plot width is known', () => {
    const ticks = getTimeXTicks(sixHours, 'utc', undefined);
    expect(ticks).not.toHaveProperty('axisTick');
    expect(ticks.axisLabel).not.toHaveProperty('customValues');
  });

  it('gives the ticks and the labels one tick list (#1085)', () => {
    const ticks = getTimeXTicks(sixHours, 'utc', 600);
    expect(ticks.axisTick?.customValues.length).toBeGreaterThan(1);
    expect(ticks.axisLabel).toHaveProperty('customValues', ticks.axisTick?.customValues);
  });

  it.each([
    ['5 minutes', 5 * 60 * 1000, 60 * 1000],
    ['7 days', 7 * 24 * 60 * 60 * 1000, 24 * 60 * 60 * 1000],
  ])('gives no two labels the same text on a wide plot of %s', (_, span, step) => {
    const from = Date.UTC(2026, 0, 1);
    const values = getTimeXTicks(range(from, from + span), 'utc', 4000).axisTick!.customValues;
    values.slice(1).forEach((value, i) => expect(value - values[i]).toBeGreaterThanOrEqual(step));
  });

  it('gives a narrow plot fewer ticks than a wide plot', () => {
    const count = (width: number) => getTimeXTicks(sixHours, 'utc', width).axisTick!.customValues.length;
    expect(count(1200)).toBeGreaterThan(count(200));
  });
});

describe('getEdgeLabels', () => {
  it('keeps the label of a single tick', () => {
    expect(getEdgeLabels(1, true, true)).toEqual({});
  });

  it('keeps the first label of 2 ticks near both edges', () => {
    expect(getEdgeLabels(2, true, true)).toEqual({ showMaxLabel: false });
  });

  it('hides the labels near the edges of more ticks', () => {
    expect(getEdgeLabels(5, true, true)).toEqual({ showMinLabel: false, showMaxLabel: false });
    expect(getEdgeLabels(5, false, false)).toEqual({});
  });
});
