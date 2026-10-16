import { GraphTransform } from '@grafana/schema';
import { barRects, categoryFrame, drawnTexts, labelTexts, renderBars } from 'test/barCanvas';

// Value labels (core Bar chart "Show values" and "Text size > Value"): Auto,
// Always and Never, the label position of negative bars, the fitted label size
// and the space kept above the tallest bar. Core: bars.ts (`showValue`,
// `VALUE_MIN_FONT_SIZE`, `calculateFontSizeWithMetrics`).

const frame = () => categoryFrame([{ name: 'A', values: [10, 20, 30, 40] }]);
const fontPx = (font: string | undefined) => Number(/(\d+(?:\.\d+)?)px/.exec(font ?? '')?.[1]);

describe('bar value labels', () => {
  it('labels bars in Auto mode', async () => {
    expect(labelTexts((await renderBars([frame()], { showValues: 'auto' })).series)).toEqual(['10', '20', '30', '40']);
  });

  it('labels no line in Auto mode, as core Time series', async () => {
    const { series } = await renderBars([frame()], { seriesType: 'line', showValues: 'auto' });
    expect(labelTexts(series)).toEqual([]);
  });

  it('labels lines too in Always mode', async () => {
    const { series } = await renderBars([frame()], { seriesType: 'line', showValues: 'always' });
    expect(labelTexts(series)).toEqual(['10', '20', '30', '40']);
  });

  it('draws no labels in Never mode', async () => {
    expect(labelTexts((await renderBars([frame()], { showValues: 'never' })).series)).toEqual([]);
  });

  it('draws the label of a negative bar below its end', async () => {
    const { series } = await renderBars([categoryFrame([{ name: 'A', values: [30, -30, 30, -30] }])], {
      showValues: 'always',
    });
    const rects = barRects(series);
    const label = drawnTexts(series).find(({ text }) => text === '-30');
    const bar = rects.find((rect) => label && rect.x <= label.x && label.x <= rect.x + rect.width);
    expect(label).toBeDefined();
    expect(bar).toBeDefined();
    expect(label!.y).toBeGreaterThan(bar!.y + bar!.height);
  });

  it('labels a "Negative Y" bar with the field value, not the drawn one', async () => {
    const transformed = categoryFrame([
      { name: 'A', values: [12, 30, 5, 8], config: { custom: { transform: GraphTransform.NegativeY } } },
    ]);
    expect(labelTexts((await renderBars([transformed], { showValues: 'always' })).series).sort()).toEqual([
      '12',
      '30',
      '5',
      '8',
    ]);
  });

  it('keeps the label of the tallest bar inside the canvas', async () => {
    const { series } = await renderBars([frame()], { showValues: 'always' });
    const top = drawnTexts(series).find(({ text }) => text === '40');
    // The text baseline sits above the bar; its top must not leave the canvas.
    expect(top!.y - fontPx(top!.font)).toBeGreaterThanOrEqual(0);
  });

  it('sets the label size with "Text size > Value"', async () => {
    const { series } = await renderBars([frame()], { showValues: 'always', text: { valueSize: 22 } });
    expect(new Set(drawnTexts(series).map(({ font }) => fontPx(font)))).toEqual(new Set([22]));
  });

  it('shrinks the auto label size on narrow bars', async () => {
    const labels = Array.from({ length: 12 }, (_, i) => `c${i}`);
    const narrow = categoryFrame([{ name: 'A', values: labels.map((_, i) => 100 + i) }], labels);
    const wide = await renderBars([frame()], { showValues: 'always' });
    const small = await renderBars([narrow], { showValues: 'always' });
    const size = (events: typeof wide.series) => fontPx(drawnTexts(events)[0]?.font);
    expect(size(small.series)).toBeLessThan(size(wide.series));
  });

  it('draws no labels when the bars are too narrow for 8px text, as core', async () => {
    const labels = Array.from({ length: 120 }, (_, i) => `c${i}`);
    const crowded = categoryFrame([{ name: 'A', values: labels.map((_, i) => 1000 + i) }], labels);
    expect(labelTexts((await renderBars([crowded], { showValues: 'always' })).series)).toEqual([]);
  });
});
