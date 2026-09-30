import { getHueGradientStops, getOpacityGradientStops } from './gradientColors';

// The gradient colors of core `gradientFills.ts`. The expected hue colors are the output of `tinycolor2` 1.6.0
// with the steps of core `getHueGradientFn`.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/config/gradientFills.ts

describe('getOpacityGradientStops', () => {
  it('goes from the color at the opacity on the top to transparent at the bottom, as core colorManipulator.alpha', () => {
    expect(getOpacityGradientStops('#73BF69', 0.8)).toEqual([
      { offset: 0, color: '#73BF69cc' },
      { offset: 1, color: '#73BF6900' },
    ]);
  });
});

describe('getHueGradientStops', () => {
  it.each([
    ['#73BF69', 'rgba(154, 243, 174, 0.8)', 'rgba(113, 154, 66, 0.8)', 'rgba(138, 183, 87, 0.8)'],
    ['#F2CC0C', 'rgba(240, 255, 76, 0.8)', 'rgba(169, 76, 8, 0.8)', 'rgba(218, 97, 11, 0.8)'],
    ['#8AB8FF', 'rgba(214, 217, 255, 0.8)', 'rgba(61, 218, 255, 0.8)', 'rgba(112, 228, 255, 0.8)'],
    ['#FF780A', 'rgba(255, 233, 86, 0.8)', 'rgba(188, 6, 0, 0.8)', 'rgba(239, 8, 0, 0.8)'],
    ['#808080', 'rgba(197, 173, 160, 0.8)', 'rgba(90, 90, 90, 0.8)', 'rgba(115, 115, 115, 0.8)'],
  ])('gives the tinycolor2 colors of core for %s', (color, top, darkBottom, lightBottom) => {
    expect(getHueGradientStops(color, 0.8, true)).toEqual([
      { offset: 0, color: top },
      { offset: 1, color: darkBottom },
    ]);
    expect(getHueGradientStops(color, 0.8, false)).toEqual([
      { offset: 0, color: top },
      { offset: 1, color: lightBottom },
    ]);
  });

  it('gives hex colors at an opacity of 1, as tinycolor2 for a hex color', () => {
    expect(getHueGradientStops('#73BF69', 1, true).map(({ color }) => color)).toEqual(['#9af3ae', '#719a42']);
  });
});
