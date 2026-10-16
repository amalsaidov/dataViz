import { StackingMode } from '@grafana/schema';
import { barRects, categoryFrame, countOf, fills, lineWidths, renderBars, rgbOf, strokes } from 'test/barCanvas';
import { theme } from 'test/panel';

// Bar style (core Bar chart "Fill opacity", "Line width", "Bar radius", group and
// bar width): an 80% fill with a solid 1 px border by default, the value-end
// corner radius on the top of a stack only, and core's default bar spacing.
// Core: panelcfg.gen.ts `defaultFieldConfig`, bars.ts `radius` and `distribute`.

const green = rgbOf(theme.visualization.getColorByName('green'));
const oneSeries = () => categoryFrame([{ name: 'A', values: [10, 20, 30, 40] }]);
const twoSeries = () =>
  categoryFrame([
    { name: 'A', values: [10, 20, 30, 40] },
    { name: 'B', values: [30, 20, 10, 40] },
  ]);

/** Rounded corners draw arcs; a square bar draws a plain `rect`. */
const roundedBars = async (...args: Parameters<typeof renderBars>) =>
  countOf((await renderBars(...args)).series, 'arc');

describe('bar style', () => {
  it('fills bars at 80% of the series color by default, as core', async () => {
    expect(fills((await renderBars([oneSeries()])).series)).toContain(`rgba(${green}, 0.8)`);
  });

  it('sets the fill with "Bar fill opacity"', async () => {
    expect(fills((await renderBars([oneSeries()], { barFillOpacity: 30 })).series)).toContain(`rgba(${green}, 0.3)`);
  });

  it('draws a solid border by default (1 px, the canvas default width), and the "Line width" border when set', async () => {
    const { series } = await renderBars([oneSeries()]);
    expect(countOf(series, 'stroke')).toBeGreaterThan(0);
    expect(strokes(series)).toContain(theme.visualization.getColorByName('green').toLowerCase());
    expect(lineWidths(series).has(3)).toBe(false);
    expect(lineWidths((await renderBars([oneSeries()], { lineWidth: 3 })).series)).toContain(3);
  });

  it('draws no border with "Line width" 0', async () => {
    expect(countOf((await renderBars([oneSeries()], { lineWidth: 0 })).series, 'stroke')).toBe(0);
  });

  it('rounds the bars with "Bar radius"', async () => {
    expect(await roundedBars([oneSeries()])).toBe(0);
    expect(await roundedBars([oneSeries()], { barRadius: 6 })).toBeGreaterThan(0);
  });

  it('rounds only the value end: half the corners of a square bar', async () => {
    // A bar with all four corners round draws twice the arcs of a value-end one.
    const valueEnd = await roundedBars([oneSeries()], { barRadius: 6 });
    expect(valueEnd % 4).toBe(0);
    expect(valueEnd / 4).toBe(2);
  });

  it('rounds only the top bar of a stack, as core', async () => {
    const unstacked = await roundedBars([twoSeries()], { barRadius: 6 });
    const stacked = await roundedBars([twoSeries()], { barRadius: 6, stacking: StackingMode.Normal });
    expect(stacked).toBe(unstacked / 2);
  });

  it('fills 97% of the category with one bar, and 70% with a group, as core', async () => {
    const single = barRects((await renderBars([oneSeries()])).series);
    const grouped = barRects((await renderBars([twoSeries()])).series);
    const band = single[1].x - single[0].x;
    expect(single[0].width / band).toBeCloseTo(0.97, 1);
    // Two bars of one group, and the gap between them, span 70% of the band.
    const [first, second] = [...grouped].sort((a, b) => a.x - b.x);
    expect((second.x + second.width - first.x) / band).toBeCloseTo(0.7, 1);
  });

  it('narrows the bars with "Bar width"', async () => {
    const [bar] = barRects((await renderBars([oneSeries()], { barWidth: 30 })).series);
    const [wide] = barRects((await renderBars([oneSeries()])).series);
    expect(bar.width).toBeLessThan(wide.width / 2);
  });
});
