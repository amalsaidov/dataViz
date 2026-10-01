import { FieldColorModeId, FieldType, MappingType, toDataFrame } from '@grafana/data';
import { StackingMode, VizOrientation } from '@grafana/schema';
import {
  estimateBarThickness,
  getBarGaps,
  getOverlapBarGaps,
  getBarItemStyle,
  getBarLabelFontSize,
  getBarValueEndRadius,
  hasPerBarColor,
  isHorizontalBars,
  resolvePanelStacking,
  toPercentOfTotal,
} from 'lib/echarts/options/bars';

describe('resolvePanelStacking', () => {
  it('reads the Stacking option, and the legacy stackSeries switch when it is unset', () => {
    expect(resolvePanelStacking({ stacking: StackingMode.Percent })).toBe(StackingMode.Percent);
    expect(resolvePanelStacking({ stacking: StackingMode.None, stackSeries: true })).toBe(StackingMode.None);
    expect(resolvePanelStacking({ stackSeries: true })).toBe(StackingMode.Normal);
    expect(resolvePanelStacking({})).toBe(StackingMode.None);
  });
});

describe('isHorizontalBars', () => {
  it('turns Auto bars in a panel taller than wide, as core BarChartPanel', () => {
    expect(isHorizontalBars(VizOrientation.Auto, true, 300, 600)).toBe(true);
    expect(isHorizontalBars(VizOrientation.Auto, true, 600, 300)).toBe(false);
    expect(isHorizontalBars(undefined, true, 300, 600)).toBe(true);
  });

  it('obeys an explicit orientation, and never turns a time axis', () => {
    expect(isHorizontalBars(VizOrientation.Horizontal, true, 600, 300)).toBe(true);
    expect(isHorizontalBars(VizOrientation.Vertical, true, 300, 600)).toBe(false);
    expect(isHorizontalBars(VizOrientation.Horizontal, false, 300, 600)).toBe(false);
  });
});

describe('getBarGaps', () => {
  it('fills 97% of the category with one bar or one stack, and 70% with a group', () => {
    expect(getBarGaps(1)).toEqual({ barCategoryGap: '3%', barGap: '3%' });
    expect(getBarGaps(3)).toEqual({ barCategoryGap: '30%', barGap: '3%' });
  });

  it('draws the bars of a time band on top of each other, as core Time series', () => {
    expect(getOverlapBarGaps()).toEqual({ barCategoryGap: '3%', barGap: '-100%' });
  });
});

describe('getBarItemStyle', () => {
  it('fills at 80% with a solid 1px border by default, as core Bar chart', () => {
    expect(getBarItemStyle('#ff0000', {})).toEqual({ color: '#ff0000cc', borderColor: '#ff0000', borderWidth: 1 });
  });

  it('applies the fill opacity and the line width', () => {
    expect(getBarItemStyle('#ff0000', { barFillOpacity: 50, lineWidth: 3 })).toEqual({
      color: '#ff000080',
      borderColor: '#ff0000',
      borderWidth: 3,
    });
  });
});

describe('getBarValueEndRadius', () => {
  it('rounds only the value end of the bar', () => {
    expect(getBarValueEndRadius(4, 10, false)).toEqual([4, 4, 0, 0]);
    expect(getBarValueEndRadius(4, -10, false)).toEqual([0, 0, 4, 4]);
    expect(getBarValueEndRadius(4, 10, true)).toEqual([0, 4, 4, 0]);
    expect(getBarValueEndRadius(4, -10, true)).toEqual([4, 0, 0, 4]);
  });
});

describe('hasPerBarColor', () => {
  const field = (config: object) =>
    toDataFrame({ fields: [{ name: 'v', type: FieldType.number, values: [1], config }] }).fields[0];

  it('is true for the thresholds color scheme and for colored value mappings, as core prepConfig', () => {
    expect(hasPerBarColor(field({ color: { mode: FieldColorModeId.Thresholds } }))).toBe(true);
    expect(
      hasPerBarColor(
        field({ mappings: [{ type: MappingType.RangeToText, options: { from: 0, to: 1, result: { color: 'red' } } }] })
      )
    ).toBe(true);
    expect(
      hasPerBarColor(field({ mappings: [{ type: MappingType.ValueToText, options: { 1: { text: 'one' } } }] }))
    ).toBe(false);
    expect(hasPerBarColor(field({ color: { mode: FieldColorModeId.PaletteClassic } }))).toBe(false);
  });
});

describe('toPercentOfTotal', () => {
  it('divides each value by the absolute stack total at its index', () => {
    expect(
      toPercentOfTotal([
        [1, 3, null],
        [3, -1, 0],
      ])
    ).toEqual([
      [0.25, 0.75, null],
      [0.75, -0.25, 0],
    ]);
  });
});

describe('estimateBarThickness', () => {
  it('splits the band into the group slots', () => {
    expect(estimateBarThickness(400, 4, 1)).toBeCloseTo(100 * 0.97 * 0.97);
    expect(estimateBarThickness(400, 4, 2)).toBeCloseTo((100 * 0.7 * 0.97) / 2);
    expect(estimateBarThickness(400, 0, 1)).toBe(0);
  });
});

describe('getBarLabelFontSize', () => {
  it('uses the "Text size > Value" option when it is set', () => {
    expect(getBarLabelFontSize(['123'], 2, false, 20)).toBe(20);
  });

  it('shrinks the auto size to the bar width and caps it', () => {
    const wide = getBarLabelFontSize(['12'], 400, false, undefined);
    const narrow = getBarLabelFontSize(['1234'], 30, false, undefined);
    expect(wide).toBe(14);
    expect(narrow).not.toBeNull();
    expect(narrow!).toBeLessThan(wide!);
  });

  it('hides the labels when the auto size is under 8px, as core', () => {
    expect(getBarLabelFontSize(['123456789'], 5, false, undefined)).toBeNull();
  });
});
