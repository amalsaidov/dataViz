import { VizOrientation } from '@grafana/schema';
import { barRects, categoryFrame, drawnTexts, renderBars } from 'test/barCanvas';
import { theme } from 'test/panel';

// Orientation (core Bar chart `orientation`): Auto turns the bars in a panel
// taller than wide, Horizontal and Vertical force it, and only a bar panel turns.
// Core: public/app/plugins/panel/barchart/BarChartPanel.tsx.

const frame = () => categoryFrame([{ name: 'A', values: [10, 20, 30, 40] }]);

/** True when the longest bar is wider than tall. */
const isHorizontal = async (...args: Parameters<typeof renderBars>) => {
  const rects = barRects((await renderBars(...args)).series);
  const longest = rects.reduce((best, rect) => (rect.width * rect.height > best.width * best.height ? rect : best));
  return longest.width > longest.height;
};

describe('bar orientation', () => {
  it('turns Auto bars in a panel taller than wide', async () => {
    expect(await isHorizontal([frame()], { orientation: VizOrientation.Auto }, { width: 300, height: 600 })).toBe(true);
    expect(await isHorizontal([frame()], { orientation: VizOrientation.Auto }, { width: 600, height: 300 })).toBe(
      false
    );
  });

  it('forces the direction with Horizontal and Vertical', async () => {
    expect(await isHorizontal([frame()], { orientation: VizOrientation.Horizontal })).toBe(true);
    expect(await isHorizontal([frame()], { orientation: VizOrientation.Vertical }, { width: 300, height: 600 })).toBe(
      false
    );
  });

  it('draws the first category at the top of horizontal bars, as core', async () => {
    const { axis, grid } = await renderBars([frame()], { orientation: VizOrientation.Horizontal });
    const labels = [...drawnTexts(axis), ...drawnTexts(grid)].filter(({ text }) => /^Q\d$/.test(text));
    const top = labels.reduce((best, label) => (label.y < best.y ? label : best));
    expect(top.text).toBe('Q1');
  });

  it('draws the threshold lines across the value axis of horizontal bars', async () => {
    const withThresholds = categoryFrame([
      {
        name: 'A',
        values: [10, 20, 30, 40],
        config: {
          thresholds: {
            mode: 'absolute',
            steps: [
              { value: -Infinity, color: 'green' },
              { value: 25, color: 'red' },
            ],
          },
          custom: { thresholdsStyle: { mode: 'line' } },
        },
      },
    ]);
    // Mark lines paint on the grid layer.
    const { grid } = await renderBars([withThresholds], { orientation: VizOrientation.Horizontal });
    const red = theme.visualization.getColorByName('red').toLowerCase();
    // The red line runs from one point to another at the same x.
    const start = grid.findIndex((event) => event.type === 'strokeStyle' && event.props.value === red);
    const path = grid
      .slice(start)
      .filter((event) => event.type === 'moveTo' || event.type === 'lineTo')
      .slice(0, 2);
    expect(start).toBeGreaterThanOrEqual(0);
    expect(Number(path[0].props.x)).toBeCloseTo(Number(path[1].props.x), 0);
    expect(Number(path[0].props.y)).not.toBeCloseTo(Number(path[1].props.y), 0);
  });

  it('keeps a category line chart upright', async () => {
    const { axis, grid } = await renderBars([frame()], { seriesType: 'line', orientation: VizOrientation.Horizontal });
    // The categories stay on one row along x.
    const labels = [...drawnTexts(axis), ...drawnTexts(grid)].filter(({ text }) => /^Q\d$/.test(text));
    expect(labels).toHaveLength(4);
    expect(new Set(labels.map(({ y }) => Math.round(y))).size).toBe(1);
  });
});
