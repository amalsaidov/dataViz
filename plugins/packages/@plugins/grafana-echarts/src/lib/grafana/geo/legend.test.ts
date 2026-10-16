import { createDataFrame, createTheme, FieldColorModeId, FieldType, ThresholdsMode } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import { getMarkerLegends } from './legend';

const theme = createTheme();

const frame = (config = {}) =>
  createDataFrame({
    fields: [
      { name: 'lat', type: FieldType.number, values: [1, 2] },
      { name: 'lon', type: FieldType.number, values: [1, 2] },
      { name: 'value', type: FieldType.number, values: [10, 90], config },
    ],
  });

const thresholds = {
  mode: ThresholdsMode.Absolute,
  steps: [
    { value: -Infinity, color: 'green' },
    { value: 80, color: 'red' },
  ],
};

const layer = (config: object): MapLayerOptions => ({ type: 'markers', name: 'Cities', config });

describe('getMarkerLegends', () => {
  it('shows the core default symbol and color for an unset layers option', () => {
    expect(getMarkerLegends([frame()], undefined, theme)).toEqual([
      {
        name: 'Layer 1',
        body: {
          kind: 'symbol',
          symbol: 'img/icons/marker/circle.svg',
          color: theme.visualization.getColorByName('dark-green'),
          opacity: 0.4,
        },
      },
    ]);
  });

  it('names each unnamed layer by its position, as the layer editor names a new layer', () => {
    const style = { symbol: { fixed: 'img/icons/marker/circle.svg' }, color: { fixed: 'red' } };
    const unnamed = (): MapLayerOptions => ({ type: 'markers', name: '', config: { style } });

    expect(getMarkerLegends([frame()], [unnamed(), unnamed()], theme).map((l) => l.name)).toEqual([
      'Layer 1',
      'Layer 2',
    ]);
  });

  it('shows no legend for showLegend false', () => {
    expect(getMarkerLegends([frame()], [layer({ showLegend: false })], theme)).toEqual([]);
  });

  it('shows no legend for a fixed color with no symbol, as core', () => {
    expect(getMarkerLegends([frame()], [layer({ style: { color: { fixed: 'red' } } })], theme)).toEqual([]);
  });

  it('shows the thresholds of the color field, as core getThresholdItems', () => {
    const [legend] = getMarkerLegends(
      [frame({ thresholds, color: { mode: FieldColorModeId.Thresholds } })],
      [layer({ style: { color: { field: 'value' } } })],
      theme
    );

    expect(legend).toEqual({
      name: 'Cities',
      body: {
        kind: 'thresholds',
        items: [
          { label: '< 80', color: theme.visualization.getColorByName('green') },
          { label: '80+', color: theme.visualization.getColorByName('red') },
        ],
      },
    });
  });

  it('shows no legend for a color field with one threshold step', () => {
    const config = { thresholds: { ...thresholds, steps: [thresholds.steps[0]] } };

    expect(getMarkerLegends([frame(config)], [layer({ style: { color: { field: 'value' } } })], theme)).toEqual([]);
  });

  it('shows a gradient from the field min to the field max for a continuous scheme', () => {
    const [legend] = getMarkerLegends(
      [frame({ color: { mode: FieldColorModeId.ContinuousGrYlRd } })],
      [layer({ style: { color: { field: 'value' } } })],
      theme
    );

    expect(legend.body).toMatchObject({ kind: 'scale', min: '10', max: '90' });
    expect(legend.body.kind === 'scale' && legend.body.colors.length).toBeGreaterThan(1);
  });
});
