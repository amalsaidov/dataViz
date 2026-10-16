import { createTheme, FieldColorModeId, FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { SERIES_ZLEVEL } from 'test/canvas';
import { getComponent, getSeriesCanvasEvents } from 'test/panel';

// Each by-series color scheme draws other fills than the classic palette (#197).
// https://grafana.com/docs/grafana/latest/panels-visualizations/configure-standard-options/#color-scheme
const theme = createTheme();

// The test helper pins palette-classic on a field without a color, so the scheme
// goes on the value field itself.
const frameWith = (mode: FieldColorModeId, fixedColor?: string) =>
  toDataFrame({
    fields: [
      { name: 'category', type: FieldType.string, values: ['Sales', 'Admin', 'IT'] },
      { name: 'value', type: FieldType.number, values: [43, 10, 30], config: { color: { mode, fixedColor } } },
    ],
  });

// The fill colors that the series layer draws.
const drawnFills = async (seriesType: 'treemap' | 'sunburst', mode: FieldColorModeId, fixedColor?: string) => {
  const { container, unmount } = render(
    getComponent(
      [frameWith(mode, fixedColor)],
      seriesType,
      { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false } },
      undefined,
      undefined,
      'hierarchy'
    )
  );
  const { seriesEvents } = await getSeriesCanvasEvents(container);
  unmount();
  const fills = seriesEvents
    .filter((event) => event.type === 'fillStyle')
    .map((event) => String((event.props as { value: unknown }).value).toLowerCase());
  return new Set(fills);
};

const toHex = (name: string) => theme.visualization.getColorByName(name).toLowerCase();

describe.each(['treemap', 'sunburst'] as const)('%s color schemes', (seriesType) => {
  it.each([
    ['Single color', FieldColorModeId.Fixed, 'dark-red'],
    ['Shades', FieldColorModeId.Shades, 'green'],
    ['Gradient', FieldColorModeId.Gradient, 'blue'],
    ['Color blind safe', FieldColorModeId.PaletteColorblind, undefined],
    ['Classic palette (by name)', FieldColorModeId.PaletteClassicByName, undefined],
  ])('%s draws other fills than the classic palette', async (_name, mode, fixedColor) => {
    const classic = await drawnFills(seriesType, FieldColorModeId.PaletteClassic);
    const scheme = await drawnFills(seriesType, mode, fixedColor);
    expect(scheme).not.toEqual(classic);
  });

  it('Single color draws the resolved fixed color', async () => {
    expect(await drawnFills(seriesType, FieldColorModeId.Fixed, 'dark-red')).toContain(toHex('dark-red'));
  });
});
