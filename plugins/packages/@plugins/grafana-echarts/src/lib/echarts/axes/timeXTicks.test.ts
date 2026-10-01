import { dateTime, type TimeRange } from '@grafana/data';
import { getTimeXTicks } from 'lib/echarts/axes/timeXTicks';

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
    expect(ticks).not.toHaveProperty('splitNumber');
  });

  it('gives a narrow plot fewer ticks than a wide plot', () => {
    const narrow = getTimeXTicks(sixHours, 'utc', 200).splitNumber!;
    const wide = getTimeXTicks(sixHours, 'utc', 1200).splitNumber!;
    expect(narrow).toBeGreaterThanOrEqual(1);
    expect(wide).toBeGreaterThan(narrow);
  });

  it('gives fewer ticks to the wider labels of a multi-day range', () => {
    const days = range(Date.UTC(2026, 0, 1), Date.UTC(2026, 0, 3, 6));
    const ticks = (r: TimeRange) => getTimeXTicks(r, 'utc', 1200).splitNumber!;
    expect(ticks(days)).toBeLessThanOrEqual(ticks(sixHours));
  });
});
