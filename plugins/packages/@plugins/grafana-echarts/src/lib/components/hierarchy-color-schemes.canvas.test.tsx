import { FieldColorModeId, FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getComponent, getSeriesCanvasEvents, height, width } from 'test/panel';

// Baselines of a treemap and a sunburst for each by-series color scheme (#197).
// The test helper pins palette-classic on a field without a color, so the scheme
// goes on the value field itself.
const frameWith = (mode: FieldColorModeId, fixedColor?: string) =>
  toDataFrame({
    fields: [
      { name: 'category', type: FieldType.string, values: ['Sales', 'Admin', 'IT'] },
      { name: 'value', type: FieldType.number, values: [43, 10, 30], config: { color: { mode, fixedColor } } },
    ],
  });

const schemes: Array<[string, FieldColorModeId, string | undefined]> = [
  ['Single color', FieldColorModeId.Fixed, 'dark-red'],
  ['Shades', FieldColorModeId.Shades, 'green'],
  ['Gradient', FieldColorModeId.Gradient, 'blue'],
  ['Color blind safe', FieldColorModeId.PaletteColorblind, undefined],
  ['Classic palette (by name)', FieldColorModeId.PaletteClassicByName, undefined],
];

const renderScheme = async (seriesType: 'treemap' | 'sunburst', mode: FieldColorModeId, fixedColor?: string) => {
  const { container } = render(
    getComponent(
      [frameWith(mode, fixedColor)],
      seriesType,
      { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false } },
      undefined,
      undefined,
      'hierarchy'
    )
  );
  return getSeriesCanvasEvents(container);
};

describe('hierarchy color scheme canvas renders', () => {
  describe.each(['treemap', 'sunburst'] as const)('%s', (seriesType) => {
    it.each(schemes)('%s', async (_name, mode, fixedColor) => {
      const { defaultEvents, seriesEvents } = await renderScheme(seriesType, mode, fixedColor);
      expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
    });
  });
});
