import { FieldColorModeId, MappingType } from '@grafana/data';
import { categoryFrame, fills, renderBars, rgbOf } from 'test/barCanvas';
import { getPaletteColorByIndex } from 'lib/echarts/style';
import { theme } from 'test/panel';

// Bar colors (core Bar chart): the classic palette counts only value fields,
// thresholds and colored value mappings color each bar, and "Color by field"
// colors each bar from a sibling field. Core: utils.ts `prepSeries`
// (`setClassicPaletteIdxs`) and `prepConfig` (`getColor`).

/** The recorded fill of a bar in `color` at the default 80% opacity. */
const barFill = (color: string, opacity = 0.8) =>
  `rgba(${rgbOf(theme.visualization.getColorByName(color))}, ${opacity})`;
/** The fill of a bar in classic palette slot `index`. */
const paletteFill = (index: number) => `rgba(${rgbOf(getPaletteColorByIndex(index, theme))}, 0.8)`;
const thresholds = (steps: Array<[number, string]>) => ({
  mode: 'absolute',
  steps: steps.map(([value, color]) => ({ value, color })),
});

describe('bar colors', () => {
  it('gives the first value field the first palette color, as core: the label column takes no slot', async () => {
    const frame = categoryFrame([
      { name: 'A', values: [1, 2, 3, 4] },
      { name: 'B', values: [4, 3, 2, 1] },
    ]);
    const drawn = fills((await renderBars([frame])).series);
    expect(drawn).toEqual(new Set([paletteFill(0), paletteFill(1)]));
  });

  it('fills each bar from its threshold step', async () => {
    const frame = categoryFrame([
      {
        name: 'A',
        values: [5, 50, 60, 5],
        config: {
          color: { mode: FieldColorModeId.Thresholds },
          thresholds: thresholds([
            [-Infinity, 'blue'],
            [10, 'red'],
          ]),
        },
      },
    ]);
    const drawn = fills((await renderBars([frame])).series);
    expect(drawn).toContain(barFill('blue'));
    expect(drawn).toContain(barFill('red'));
  });

  it('fills the bars a value mapping matches, and keeps the series color for the others', async () => {
    const frame = categoryFrame([
      {
        name: 'A',
        values: [5, 50, 60, 5],
        config: {
          mappings: [{ type: MappingType.RangeToText, options: { from: 0, to: 10, result: { color: 'purple' } } }],
        },
      },
    ]);
    const drawn = fills((await renderBars([frame])).series);
    expect(drawn).toContain(barFill('purple'));
    expect(drawn).toContain(paletteFill(0));
  });

  it('fills each bar from the "Color by field" field at the same row', async () => {
    const frame = categoryFrame([
      { name: 'Sales', values: [40, 25, 33, 50] },
      {
        name: 'Score',
        values: [20, 80, 55, 95],
        config: {
          color: { mode: FieldColorModeId.Thresholds },
          thresholds: thresholds([
            [-Infinity, 'red'],
            [50, 'orange'],
            [80, 'purple'],
          ]),
        },
      },
    ]);
    const plain = fills((await renderBars([frame])).series);
    const colored = fills((await renderBars([frame], { colorByField: 'Score' })).series);
    // Sales takes the Score colors instead of its palette color.
    expect(plain).toContain(paletteFill(0));
    expect(colored).not.toContain(paletteFill(0));
    for (const color of ['red', 'orange', 'purple']) {
      expect(colored).toContain(barFill(color));
    }
  });

  it('applies "Bar fill opacity" to the per-bar colors', async () => {
    const frame = categoryFrame([
      {
        name: 'A',
        values: [5, 50, 60, 5],
        config: {
          color: { mode: FieldColorModeId.Thresholds },
          thresholds: thresholds([
            [-Infinity, 'blue'],
            [10, 'red'],
          ]),
        },
      },
    ]);
    expect(fills((await renderBars([frame], { barFillOpacity: 50 })).series)).toContain(barFill('red', 0.5));
  });
});
