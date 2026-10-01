import { measureAxisLabelWidth } from 'lib/grafana/axisLabelWidth';

describe('measureAxisLabelWidth', () => {
  it('returns the width of the widest label', () => {
    const narrow = measureAxisLabelWidth(['10:00'], 12);
    const wide = measureAxisLabelWidth(['10/01 10:00'], 12);
    expect(wide).toBeGreaterThan(narrow);
    expect(measureAxisLabelWidth(['10:00', '10/01 10:00', '11:00'], 12)).toBe(wide);
  });

  it('returns 0 for no labels', () => {
    expect(measureAxisLabelWidth([], 12)).toBe(0);
  });
});
