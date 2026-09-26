import { createTheme, FieldColorModeId, FieldType, MappingType, toDataFrame, type ValueFormatter } from '@grafana/data';
import { GraphTransform, StackingMode } from '@grafana/schema';
import {
  buildCartesianData,
  getBarLabelTexts,
  getPerBarColors,
  resolveDrawnValues,
  resolveSeriesValues,
} from 'lib/echarts/converters/cartesianValues';
import { type CartesianSeriesSource } from 'lib/echarts/converters/types';
import { applyGrafanaFieldDefaults } from 'test/panel';
import { type PanelOptions } from 'types';

const theme = createTheme();
const formatValue: ValueFormatter = (value) => ({ text: `${value}`, suffix: ' u' });

/** A bar source over `values`, with Grafana's field defaults (and display processor) applied. */
const source = (values: number[], config: object = {}, extra: Partial<CartesianSeriesSource> = {}) => {
  const [frame] = applyGrafanaFieldDefaults([
    toDataFrame({ fields: [{ name: 'v', type: FieldType.number, values, config }] }),
  ]);
  return {
    field: frame.fields[0],
    values,
    rows: values.map((_, row) => row),
    color: '#00ff00',
    isBar: true,
    stacked: false,
    formatValue,
    ...extra,
  };
};

describe('resolveDrawnValues', () => {
  it('draws stacked bars as a share of the stack total in percent stacking', () => {
    const drawn = resolveDrawnValues(
      [source([1, 3], {}, { stacked: true }), source([3, 1], {}, { stacked: true }), source([9, 9])],
      StackingMode.Percent
    );
    expect(drawn).toEqual([
      [0.25, 0.75],
      [0.75, 0.25],
      [9, 9],
    ]);
  });

  it('flips a "Negative Y" field below zero', () => {
    const drawn = resolveDrawnValues(
      [source([2], { custom: { transform: GraphTransform.NegativeY } })],
      StackingMode.None
    );
    expect(drawn).toEqual([[-2]]);
  });
});

describe('getBarLabelTexts', () => {
  it('labels the field value with its formatter, and the share in percent stacking', () => {
    const bar = source([1, 3], {}, { stacked: true });
    expect(getBarLabelTexts(bar, [1, 3], false, formatValue, theme)).toEqual(['1 u', '3 u']);
    expect(getBarLabelTexts(bar, [0.25, 0.75], true, formatValue, theme)).toEqual(['25%', '75%']);
  });
});

describe('getPerBarColors', () => {
  it('colors each bar from its threshold step', () => {
    const bar = source([5, 50], {
      color: { mode: FieldColorModeId.Thresholds },
      thresholds: {
        mode: 'absolute',
        steps: [
          { value: -Infinity, color: 'blue' },
          { value: 10, color: 'red' },
        ],
      },
    });
    expect(getPerBarColors(bar, undefined, bar.rows, theme)).toEqual([
      theme.visualization.getColorByName('blue'),
      theme.visualization.getColorByName('red'),
    ]);
  });

  it('colors the bars a value mapping matches, and keeps the series color for the others', () => {
    const bar = source([5, 50], {
      mappings: [{ type: MappingType.RangeToText, options: { from: 0, to: 10, result: { color: 'purple' } } }],
    });
    expect(getPerBarColors(bar, undefined, bar.rows, theme)).toEqual([
      theme.visualization.getColorByName('purple'),
      '#00ff00',
    ]);
  });

  it('colors each bar from the "Color by field" field at the same row', () => {
    const colorField = source([1, 99], {
      color: { mode: FieldColorModeId.Thresholds },
      thresholds: {
        mode: 'absolute',
        steps: [
          { value: -Infinity, color: 'green' },
          { value: 50, color: 'red' },
        ],
      },
    }).field;
    const bar = source([5, 6]);
    expect(getPerBarColors(bar, colorField, [1, 0], theme)).toEqual([
      theme.visualization.getColorByName('red'),
      theme.visualization.getColorByName('green'),
    ]);
  });

  it('gives a series with one color, or a line, no per-bar colors', () => {
    expect(getPerBarColors(source([1]), undefined, [0], theme)).toBeUndefined();
    expect(
      getPerBarColors(
        source([1], { color: { mode: FieldColorModeId.Thresholds } }, { isBar: false }),
        undefined,
        [0],
        theme
      )
    ).toBeUndefined();
  });
});

describe('buildCartesianData', () => {
  it('keeps plain values and [x, value] pairs when nothing is transformed', () => {
    expect(buildCartesianData({ drawn: [1, null], values: [1, null], horizontal: false })).toEqual([1, null]);
    expect(buildCartesianData({ xs: [10, 20], drawn: [1, 2], values: [1, 2], horizontal: false })).toEqual([
      [10, 1],
      [20, 2],
    ]);
  });

  it('adds the field value last to a transformed point, in the orientation of the axes', () => {
    expect(buildCartesianData({ drawn: [-2], values: [2], horizontal: false })).toEqual([[0, -2, 2]]);
    expect(buildCartesianData({ drawn: [-2], values: [2], horizontal: true })).toEqual([[-2, 0, 2]]);
    expect(buildCartesianData({ xs: [10], drawn: [0.5], values: [4], horizontal: false })).toEqual([[10, 0.5, 4]]);
  });

  it('sets the per-bar color and the value-end radius on the item', () => {
    expect(
      buildCartesianData({ drawn: [3, -3], values: [3, -3], horizontal: false, colors: ['#ff0000'], radius: 4 })
    ).toEqual([
      { value: 3, itemStyle: { color: '#ff0000cc', borderColor: '#ff0000', borderRadius: [4, 4, 0, 0] } },
      { value: -3, itemStyle: { borderRadius: [0, 0, 4, 4] } },
    ]);
  });
});

describe('resolveSeriesValues', () => {
  const layout = { horizontal: false, bandCount: 4, plotLength: 400 };

  it('rounds only the top stacked bar and the unstacked bars, as core', () => {
    const options = { barRadius: 5, stacking: StackingMode.Normal } as PanelOptions;
    const resolved = resolveSeriesValues(
      [source([1], {}, { stacked: true }), source([1], {}, { stacked: true }), source([1])],
      layout,
      options,
      theme
    );
    const radius = resolved.map(({ data }) => (Array.isArray(data) ? data[0] : undefined));
    expect(radius[0]).toBe(1);
    expect(radius[1]).toMatchObject({ itemStyle: { borderRadius: [5, 5, 0, 0] } });
    expect(radius[2]).toMatchObject({ itemStyle: { borderRadius: [5, 5, 0, 0] } });
  });

  it('spaces one stack as one bar, and gives lines no bar keys', () => {
    const [stacked, line] = resolveSeriesValues(
      [source([1], {}, { stacked: true }), source([1], {}, { isBar: false })],
      layout,
      {} as PanelOptions,
      theme
    );
    expect(stacked.barGaps).toEqual({ barCategoryGap: '3%', barGap: '3%' });
    expect(line).toEqual({ data: [1] });
  });

  it('sizes no labels automatically when the plot size is unknown', () => {
    const [bar] = resolveSeriesValues([source([1])], { horizontal: false, bandCount: 1 }, {} as PanelOptions, theme);
    expect(bar.labelFontSize).toBeUndefined();
    expect(bar.labelTexts).toEqual(['1 u']);
  });
});
