import { colorManipulator } from '@grafana/data';
import { AxisColorMode, ScaleDistribution, StackingMode } from '@grafana/schema';
import { getPaletteColorByIndex } from 'lib/echarts/style';
import { type BarCanvasEvent, categoryFrame, countOf, drawnTexts, renderBars, strokes } from 'test/barCanvas';
import { theme } from 'test/panel';

// Value axis options on bars (core Bar chart and the standard "Axis" field
// config): the zero baseline of a bar axis, soft and hard limits, log scale,
// centered zero, the axis label, grid lines, series color, border and width, and
// the 100% axis of percent stacking. Core: utils.ts `prepConfig` (soft min/max 0)
// and packages/grafana-ui/src/options/builder/axis.tsx.

/** Tick labels of the value axis: the axis-layer texts that are numbers. */
const ticks = (axis: BarCanvasEvent[]): number[] =>
  drawnTexts(axis)
    .map(({ text }) => Number(text.replace(/[%,]/g, '')))
    .filter((value) => Number.isFinite(value));

const frame = (config: object = {}) => categoryFrame([{ name: 'A', values: [100, 110, 120, 130], config }]);
const custom = (settings: object) => ({ custom: settings });

describe('bar value axis', () => {
  it('starts a bar axis at zero, as core Bar chart', async () => {
    expect(Math.min(...ticks((await renderBars([frame()])).axis))).toBe(0);
  });

  it('fits a line-only axis to the data, as core Time series', async () => {
    expect(Math.min(...ticks((await renderBars([frame()], { seriesType: 'line' })).axis))).toBeGreaterThan(0);
  });

  it('lets an explicit Min win over the zero baseline', async () => {
    expect(Math.min(...ticks((await renderBars([frame({ min: 90 })])).axis))).toBe(90);
  });

  it('extends the axis to the soft max', async () => {
    expect(Math.max(...ticks((await renderBars([frame(custom({ axisSoftMax: 300 }))])).axis))).toBeGreaterThanOrEqual(
      300
    );
  });

  it('extends a line axis to the soft min', async () => {
    const { axis } = await renderBars([frame(custom({ axisSoftMin: 20 }))], { seriesType: 'line' });
    expect(Math.min(...ticks(axis))).toBeLessThanOrEqual(20);
  });

  it('draws a log axis with "Scale: Logarithmic"', async () => {
    const logFrame = categoryFrame([
      {
        name: 'A',
        values: [3, 40, 700, 9000],
        config: custom({ scaleDistribution: { type: ScaleDistribution.Log, log: 10 } }),
      },
    ]);
    expect(ticks((await renderBars([logFrame])).axis)).toEqual(expect.arrayContaining([1, 10, 100, 1000, 10000]));
  });

  it('ignores the soft max on a log axis, as core uPlot.rangeLog (#564)', async () => {
    const logFrame = categoryFrame([
      {
        name: 'A',
        values: [1, 2, 3, 4],
        config: custom({ scaleDistribution: { type: ScaleDistribution.Log, log: 2 }, axisSoftMax: 10 }),
      },
    ]);
    expect(Math.max(...ticks((await renderBars([logFrame], { seriesType: 'line' })).axis))).toBe(4);
  });

  it('centers zero with "Centered zero"', async () => {
    const values = ticks((await renderBars([frame(custom({ axisCenteredZero: true }))])).axis);
    expect(Math.min(...values)).toBe(-Math.max(...values));
  });

  it('draws the axis label', async () => {
    expect(
      drawnTexts((await renderBars([frame(custom({ axisLabel: 'Spend' }))])).axis).map(({ text }) => text)
    ).toContain('Spend');
  });

  it('draws the tick labels in the series color with "Color: Series"', async () => {
    const { axis } = await renderBars([frame(custom({ axisColorMode: AxisColorMode.Series }))]);
    const color = getPaletteColorByIndex(0, theme).toLowerCase();
    expect(
      drawnTexts(axis)
        .filter(({ text }) => text === '0')
        .map(({ fillStyle }) => fillStyle)
    ).toEqual([color]);
  });

  it('draws the axis line with "Show border"', async () => {
    const plain = await renderBars([frame()]);
    const bordered = await renderBars([frame(custom({ axisBorderShow: true }))]);
    // The canvas mock records colors as hex: the line is the text color, as core.
    const text = colorManipulator.asHexString(theme.colors.text.primary).toLowerCase();
    expect(strokes(plain.axis).has(text)).toBe(false);
    expect(strokes(bordered.axis).has(text)).toBe(true);
  });

  it('hides the grid lines with "Show grid lines: Off"', async () => {
    const lines = async (events: { axis: BarCanvasEvent[]; grid: BarCanvasEvent[] }) =>
      countOf(events.axis, 'lineTo') + countOf(events.grid, 'lineTo');
    const plain = await lines(await renderBars([frame()]));
    const off = await lines(await renderBars([frame(custom({ axisGridShow: false }))]));
    expect(off).toBeLessThan(plain);
  });

  it('cuts long tick labels to the "Width"', async () => {
    const wide = categoryFrame([
      { name: 'A', values: [1000000, 2000000, 3000000, 4000000], config: custom({ axisWidth: 20 }) },
    ]);
    const labels = drawnTexts((await renderBars([wide])).axis).map(({ text }) => text);
    expect(labels.some((label) => label.endsWith('...') || label.endsWith('…'))).toBe(true);
  });

  it('draws a "Negative Y" field below zero', async () => {
    const flipped = frame({ custom: { transform: 'negative-Y' } });
    expect(Math.max(...ticks((await renderBars([flipped])).axis))).toBe(0);
  });

  it('draws a 0% to 100% axis for 100% stacking', async () => {
    const two = categoryFrame([
      { name: 'A', values: [1, 2, 3, 4], config: { unit: 'ms' } },
      { name: 'B', values: [4, 3, 2, 1], config: { unit: 'bytes' } },
    ]);
    const labels = drawnTexts((await renderBars([two], { stacking: StackingMode.Percent })).axis).map(
      ({ text }) => text
    );
    expect(labels).toEqual(expect.arrayContaining(['0%', '100%']));
  });

  // Core gives one scale to each unit (`buildScaleKey`), and 0% and 100% are soft limits of a percent scale
  // (`UPlotScaleBuilder`). So a field that does not stack draws its raw value on the percent axis (#504).
  it('draws a field that does not stack on the percent axis of its unit', async () => {
    const three = categoryFrame([
      { name: 'A', values: [1, 2, 3, 4] },
      { name: 'B', values: [4, 3, 2, 1] },
      { name: 'C', values: [3, 3, 3, 3], config: custom({ stackSeries: false }) },
    ]);
    const { axis } = await renderBars([three], { stacking: StackingMode.Percent });
    const labels = drawnTexts(axis).map(({ text }) => text);
    const values = ticks(axis);
    expect(labels.filter((label) => /\d/.test(label)).every((label) => label.endsWith('%'))).toBe(true);
    expect([Math.min(...values), Math.max(...values)]).toEqual([0, 300]);
  });
});
