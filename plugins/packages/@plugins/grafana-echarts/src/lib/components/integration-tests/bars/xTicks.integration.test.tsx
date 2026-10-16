import { categoryFrame, drawnTexts, renderBars } from 'test/barCanvas';

// X tick labels on a category axis (core Bar chart "Rotate x-axis tick labels",
// "X-axis tick label max length" and "X-axis labels minimum spacing"). Core:
// BarChartPanel.tsx (`xTickLabelMaxLength`), bars.ts (`hFilter`).

const labels = Array.from({ length: 8 }, (_, i) => `A very long category ${i}`);
const frame = () => categoryFrame([{ name: 'A', values: labels.map((_, i) => i + 1) }], labels);

/** The category tick labels drawn, on whichever layer the x-axis paints. */
const tickLabels = async (...args: Parameters<typeof renderBars>) => {
  const { axis, grid } = await renderBars(...args);
  return [...drawnTexts(axis), ...drawnTexts(grid)].filter(({ text }) => text.startsWith('A '));
};

describe('bar x tick labels', () => {
  it('cuts rotated labels at the max length, with an ellipsis', async () => {
    const drawn = await tickLabels([frame()], { xTickRotate: -45, xTickLabelMaxLength: 6 });
    expect(drawn.length).toBeGreaterThan(0);
    drawn.forEach(({ text }) => expect(text).toBe('A very...'));
  });

  it('keeps full labels when they are not rotated, as core', async () => {
    const drawn = await tickLabels([frame()], { xTickLabelMaxLength: 6 });
    drawn.forEach(({ text }) => expect(text.startsWith('A very long')).toBe(true));
  });

  it('skips labels that are closer than the minimum spacing', async () => {
    const all = await tickLabels([frame()], { xTickRotate: -45 });
    const spaced = await tickLabels([frame()], { xTickRotate: -45, xTickLabelSpacing: 200 });
    expect(all).toHaveLength(8);
    expect(spaced.length).toBeLessThan(all.length);
    const xs = spaced.map(({ x }) => x).sort((a, b) => a - b);
    for (let i = 1; i < xs.length; i++) {
      expect(xs[i] - xs[i - 1]).toBeGreaterThanOrEqual(150);
    }
  });
});
