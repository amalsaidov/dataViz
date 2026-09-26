import { StackingMode } from '@grafana/schema';
import { barRects, categoryFrame, labelTexts, renderBars, timeFrame } from 'test/barCanvas';

// Stacking (core Bar chart `stacking`): Off, Normal and 100%, the per-field
// opt-out, the legacy `stackSeries` switch, and stacks from several time frames.
// Core: public/app/plugins/panel/barchart/bars.ts (`distrOne` for stacks).

const twoSeries = () =>
  categoryFrame([
    { name: 'A', values: [10, 20, 30, 40] },
    { name: 'B', values: [30, 20, 10, 40] },
  ]);

/** Distinct left edges of the drawn bars: one per bar when grouped, one per stack when stacked. */
const columns = async (...args: Parameters<typeof renderBars>) =>
  new Set(barRects((await renderBars(...args)).series).map((rect) => Math.round(rect.x)));

describe('bar stacking', () => {
  it('draws the series side by side with Stacking Off', async () => {
    expect((await columns([twoSeries()], { stacking: StackingMode.None })).size).toBe(8);
  });

  it('draws one stack per category with Stacking Normal', async () => {
    expect((await columns([twoSeries()], { stacking: StackingMode.Normal })).size).toBe(4);
  });

  it('draws every 100% stack at the same height, whatever its total', async () => {
    const { series } = await renderBars([twoSeries()], { stacking: StackingMode.Percent });
    const heights = new Map<number, number>();
    for (const rect of barRects(series)) {
      heights.set(Math.round(rect.x), (heights.get(Math.round(rect.x)) ?? 0) + rect.height);
    }
    const totals = [...heights.values()];
    expect(totals).toHaveLength(4);
    totals.forEach((total) => expect(total).toBeCloseTo(totals[0], 0));
  });

  it('labels 100% stacks with the share of each segment', async () => {
    const { series } = await renderBars([twoSeries()], { stacking: StackingMode.Percent, showValues: 'always' });
    expect(labelTexts(series).sort()).toEqual(['25%', '25%', '50%', '50%', '50%', '50%', '75%', '75%']);
  });

  it('lets a field opt out with its own "Stacking: off" override', async () => {
    const frame = categoryFrame([
      { name: 'A', values: [10, 20, 30, 40] },
      { name: 'B', values: [30, 20, 10, 40] },
      { name: 'C', values: [5, 5, 5, 5], config: { custom: { stackSeries: false } } },
    ]);
    // One stack (A + B) and one bar (C) per category.
    expect((await columns([frame], { stacking: StackingMode.Normal })).size).toBe(8);
  });

  it('reads the legacy stackSeries switch when Stacking is unset', async () => {
    expect((await columns([twoSeries()], { stackSeries: true })).size).toBe(4);
  });

  it('stacks two time frames on their shared timestamps', async () => {
    // A has no 2.5 h point and B no 0.5 h point: the join keeps each B segment on its A base.
    const frames = [timeFrame('A', [0.5, 1, 1.5, 2], [10, 20, 15, 25]), timeFrame('B', [1, 1.5, 2, 2.5], [5, 8, 6, 9])];
    const { series } = await renderBars(frames, { stacking: StackingMode.Normal });
    const rects = barRects(series);
    // Six bands (0.5 h to 2.5 h); the three shared ones hold two segments that touch.
    const byColumn = new Map<number, typeof rects>();
    for (const rect of rects) {
      const key = Math.round(rect.x);
      byColumn.set(key, [...(byColumn.get(key) ?? []), rect]);
    }
    const stacked = [...byColumn.values()].filter((column) => column.length === 2);
    expect(stacked).toHaveLength(3);
    for (const [first, second] of stacked) {
      const [lower, upper] = first.y > second.y ? [first, second] : [second, first];
      // Within the 1 px border that ECharts keeps between stacked segments.
      expect(Math.abs(upper.y + upper.height - lower.y)).toBeLessThanOrEqual(1.5);
    }
  });

  it('keeps a line from another query continuous when bars stack, as core', async () => {
    // Two stacked bar frames at 0 h to 2 h, and a line at 0.5 h to 2.5 h. Only the bars join on
    // time, so the line gets no null at each bar timestamp and draws one path through its 3 points.
    const line = timeFrame('Line', [0.5, 1.5, 2.5], [5, 6, 7]);
    line.fields[1].config = { custom: { seriesType: 'line' } };
    const frames = [timeFrame('A', [0, 1, 2], [10, 20, 30]), timeFrame('B', [0, 1, 2], [3, 4, 5]), line];
    const { series } = await renderBars(frames, { stacking: StackingMode.Normal, showValues: 'never' });
    const linePaths = series
      .filter((event) => event.type === 'stroke')
      .map((event) => (event.props.path as Array<{ type: string }> | undefined) ?? [])
      .filter((path) => path.filter(({ type }) => type === 'lineTo').length >= 2);
    expect(linePaths).toHaveLength(1);
    // The bars still stack: one column per shared timestamp.
    expect(new Set(barRects(series).map((rect) => Math.round(rect.x))).size).toBe(3);
  });
});
