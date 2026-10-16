import { measureAxisLabelWidth, measureTimeAxisLabelWidth } from 'lib/grafana/axisLabelWidth';

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

describe('measureTimeAxisLabelWidth', () => {
  it('gives the Inter width of a default time label, with no dependency on the loaded font', () => {
    expect(measureTimeAxisLabelWidth(['14:30'], 12)).toBeCloseTo(31.072, 3);
    expect(measureTimeAxisLabelWidth(['10/02 14:30'], 12)).toBeCloseTo(66.111, 3);
    expect(measureTimeAxisLabelWidth(['14:30'], 24)).toBeCloseTo(62.145, 3);
  });

  it('returns the width of the widest label', () => {
    expect(measureTimeAxisLabelWidth(['14:30', '2026-10'], 12)).toBeCloseTo(47.619, 3);
  });

  it('uses measureText for a character that is not in the table', () => {
    expect(measureTimeAxisLabelWidth(['Oct 2'], 12)).toBe(measureAxisLabelWidth(['Oct 2'], 12));
  });
});
