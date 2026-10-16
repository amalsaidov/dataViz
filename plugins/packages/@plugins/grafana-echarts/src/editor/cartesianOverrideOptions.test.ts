import { cartesianOverrideOptions, cartesianOverrideOptionsWithAuto } from 'editor/cartesian';

describe('cartesianOverrideOptions', () => {
  it('offers only the single-value series types, since the renderer drops a multi-value type per field', () => {
    expect(cartesianOverrideOptions.map((option) => option.value)).toEqual(['line', 'bar', 'scatter', 'effectScatter']);
    expect(cartesianOverrideOptionsWithAuto.map((option) => option.value)).toEqual([
      'Auto',
      'line',
      'bar',
      'scatter',
      'effectScatter',
    ]);
  });
});
