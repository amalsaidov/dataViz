import { createDataFrame, createTheme, FieldColorModeId, FieldType, ThresholdsMode } from '@grafana/data';
import { type ColorDimensionConfig, ScalarDimensionMode, TextDimensionMode } from '@grafana/schema';
import { DEFAULT_MARKER_STYLE, getMarkerLayerStyle, getMarkerValues } from './dimensions';

// Core: https://github.com/grafana/grafana/tree/main/public/app/features/dimensions and
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/style/utils.ts
const theme = createTheme();

const frame = createDataFrame({
  fields: [
    { name: 'lat', type: FieldType.number, values: [0, 0, 0] },
    { name: 'lon', type: FieldType.number, values: [0, 0, 0] },
    {
      name: 'value',
      type: FieldType.number,
      values: [10, 20, 30],
      config: {
        unit: 'percent',
        color: { mode: FieldColorModeId.Thresholds },
        thresholds: {
          mode: ThresholdsMode.Absolute,
          steps: [
            { value: -Infinity, color: 'green' },
            { value: 25, color: 'red' },
          ],
        },
      },
    },
    { name: 'name', type: FieldType.string, values: ['a', 'b', 'c'] },
  ],
});

describe('getMarkerValues', () => {
  it('gives the core default style: dark-green, size 5, alpha 0.4 * 0.4', () => {
    const values = getMarkerValues(frame, undefined, theme)(0);
    // `#37872D` is `dark-green`. WebGL applies the opacity to the color and to the layer.
    expect(values).toEqual({
      color: '#37872D',
      fill: 'rgba(55, 135, 45, 0.16)',
      iconBackground: 'rgba(55, 135, 45, 0.04)',
      size: 5,
      rotation: 0,
      text: undefined,
    });
  });

  it('scales the size linearly from min to max over the field range, also in the quad mode', () => {
    const size = { field: 'value', fixed: 5, min: 2, max: 12, mode: 'quad' as never };
    const values = getMarkerValues(frame, { size }, theme);
    expect([0, 1, 2].map((row) => values(row).size)).toEqual([2, 7, 12]);
  });

  it('gives the fixed size for a field that is not found, and min for a field of one value', () => {
    expect(getMarkerValues(frame, { size: { field: 'none', fixed: 8, min: 2, max: 15 } }, theme)(0).size).toBe(8);
    expect(getMarkerValues(frame, { size: { field: 'lat', fixed: 8, min: 2, max: 15 } }, theme)(0).size).toBe(2);
  });

  it('colors by the thresholds of the field, with the opacity', () => {
    const values = getMarkerValues(frame, { color: { field: 'value', fixed: 'blue' }, opacity: 0.5 }, theme);
    expect(values(0).color).toBe(theme.visualization.getColorByName('green'));
    expect(values(2).color).toBe(theme.visualization.getColorByName('red'));
    expect(values(2).fill).toBe('rgba(242, 73, 92, 0.25)');
  });

  it('gives the fixed color for no color field, and grey for a field that is not found', () => {
    expect(getMarkerValues(frame, { color: { fixed: 'blue' } }, theme)(0).color).toBe(
      theme.visualization.getColorByName('blue')
    );
    // Core draws the symbol of a color that is not hex or rgb in white. The text keeps the color.
    expect(
      getMarkerValues(frame, { color: { field: 'none' } as ColorDimensionConfig, opacity: 1 }, theme)(0)
    ).toMatchObject({
      color: 'grey',
      fill: 'rgba(255, 255, 255, 1)',
    });
  });

  it('takes the rotation modulo max, or clamped', () => {
    const mod = { field: 'value', fixed: 0, min: -360, max: 25, mode: ScalarDimensionMode.Mod };
    expect(getMarkerValues(frame, { rotation: mod }, theme)(2).rotation).toBe(5);
    const clamped = { ...mod, mode: ScalarDimensionMode.Clamped };
    expect(getMarkerValues(frame, { rotation: clamped }, theme)(2).rotation).toBe(25);
  });

  it('gives the display text of a text field, or the fixed text', () => {
    const field = getMarkerValues(frame, { text: { mode: TextDimensionMode.Field, field: 'value', fixed: '' } }, theme);
    expect(field(0).text).toBe('10%');
    const fixed = getMarkerValues(frame, { text: { mode: TextDimensionMode.Fixed, fixed: 'Hi' } }, theme);
    expect(fixed(0).text).toBe('Hi');
    // Core shows no text for a text with no mode.
    expect(getMarkerValues(frame, { text: { fixed: 'Hi' } as never }, theme)(0).text).toBeUndefined();
  });
});

describe('getMarkerLayerStyle', () => {
  it('gives the core default circle and no text', () => {
    expect(getMarkerLayerStyle(undefined, theme)).toEqual({
      symbol: DEFAULT_MARKER_STYLE.symbol.fixed,
      showSymbol: true,
      symbolAlign: { horizontal: 'center', vertical: 'center' },
      text: undefined,
    });
  });

  it('draws the text only for a text and no symbol, as core', () => {
    const text = { mode: TextDimensionMode.Fixed, fixed: 'Hi' };
    const style = getMarkerLayerStyle({ text, textConfig: { fontSize: 20 } }, theme);
    expect(style.showSymbol).toBe(false);
    expect(style.text).toEqual({
      fontSize: 20,
      textAlign: 'center',
      textBaseline: 'middle',
      offsetX: 0,
      offsetY: 0,
      fontFamily: theme.typography.fontFamily,
    });
  });
});
