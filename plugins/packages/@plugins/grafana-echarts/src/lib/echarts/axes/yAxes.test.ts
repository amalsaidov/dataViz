import { createTheme, type Field, FieldType, toDataFrame, type ValueFormatter } from '@grafana/data';
import { AxisColorMode, AxisPlacement, ScaleDistribution } from '@grafana/schema';
import { AXIS_OFFSET_STEP, buildCartesianYAxes, getAxisGridSpacing, getAxisRange } from 'lib/echarts/axes/yAxes';
import { getCartesianAxisStyle } from 'lib/echarts/options/cartesian';

const theme = createTheme();
const axisStyle = getCartesianAxisStyle(theme);
const type: 'value' = 'value';
const baseYAxis = { type, scale: true };
const fallback: ValueFormatter = (value) => ({ text: `fb:${value}` });

/** Build a numeric field with a unit and optional per-field axis placement. */
const field = (name: string, unit?: string, placement?: AxisPlacement): Field => {
  const frame = toDataFrame({
    fields: [
      {
        name,
        type: FieldType.number,
        values: [1, 2, 3],
        config: { unit, ...(placement ? { custom: { axisPlacement: placement } } : {}) },
      },
    ],
  });
  return frame.fields[0];
};

/** Numeric field carrying explicit standard Min/Max bounds. */
const fieldWithBounds = (name: string, min?: number, max?: number): Field =>
  toDataFrame({
    fields: [{ name, type: FieldType.number, values: [1, 2, 3], config: { min, max } }],
  }).fields[0];

const build = (fields: Field[]) =>
  buildCartesianYAxes({ fields, baseYAxis, axisStyle, theme, fallbackFormatter: fallback });

describe('buildCartesianYAxes', () => {
  it('returns a single fallback axis when there are no fields', () => {
    const { yAxis, seriesYAxisIndex, leftAxisCount, rightAxisCount } = build([]);

    expect(yAxis).toHaveLength(1);
    expect(seriesYAxisIndex).toEqual([]);
    expect(leftAxisCount).toBe(1);
    expect(rightAxisCount).toBe(0);
  });

  it('groups fields that share a unit onto one left axis', () => {
    const { yAxis, seriesYAxisIndex, leftAxisCount, rightAxisCount } = build([
      field('a', 'bytes'),
      field('b', 'bytes'),
    ]);

    expect(yAxis).toHaveLength(1);
    expect(seriesYAxisIndex).toEqual([0, 0]);
    expect(yAxis[0].position).toBe('left');
    expect(yAxis[0].offset).toBe(0);
    expect(leftAxisCount).toBe(1);
    expect(rightAxisCount).toBe(0);
  });

  it('puts the first unit on the left and additional units on the right (auto)', () => {
    const { yAxis, seriesYAxisIndex } = build([field('a', 'bytes'), field('b', 'percent')]);

    expect(yAxis).toHaveLength(2);
    expect(seriesYAxisIndex).toEqual([0, 1]);
    expect(yAxis[0].position).toBe('left');
    expect(yAxis[1].position).toBe('right');
  });

  it('only the first visible axis draws split lines', () => {
    const { yAxis } = build([field('a', 'bytes'), field('b', 'percent')]);

    expect(yAxis[0].splitLine?.show).toBe(true);
    expect(yAxis[1].splitLine?.show).toBe(false);
  });

  it('honors explicit Left/Right placement overrides', () => {
    const { yAxis } = build([field('a', 'bytes', AxisPlacement.Right), field('b', 'percent', AxisPlacement.Left)]);

    expect(yAxis[0].position).toBe('right');
    expect(yAxis[1].position).toBe('left');
  });

  it('stacks multiple axes on the same side with increasing offsets', () => {
    // Three units all forced right: offsets 0, STEP, 2*STEP.
    const { yAxis, rightAxisCount } = build([
      field('a', 'bytes', AxisPlacement.Right),
      field('b', 'percent', AxisPlacement.Right),
      field('c', 'watt', AxisPlacement.Right),
    ]);

    expect(yAxis.map((axis) => axis.offset)).toEqual([0, AXIS_OFFSET_STEP, 2 * AXIS_OFFSET_STEP]);
    expect(rightAxisCount).toBe(3);
  });

  it('hides a Hidden axis but still maps its series and reserves no space', () => {
    const { yAxis, seriesYAxisIndex, leftAxisCount, rightAxisCount } = build([
      field('a', 'bytes'),
      field('b', 'percent', AxisPlacement.Hidden),
    ]);

    expect(seriesYAxisIndex).toEqual([0, 1]);
    expect(yAxis[1].axisLabel?.show).toBe(false);
    expect(yAxis[1].axisTick?.show).toBe(false);
    // Hidden axis is not counted for grid spacing.
    expect(leftAxisCount).toBe(1);
    expect(rightAxisCount).toBe(0);
  });

  it('applies explicit Min/Max bounds from the field config', () => {
    const { yAxis } = build([fieldWithBounds('a', 0, 100)]);

    expect(yAxis[0].min).toBe(0);
    expect(yAxis[0].max).toBe(100);
  });

  it('applies only the bound that is set, leaving the other for auto-fit', () => {
    const { yAxis } = build([fieldWithBounds('a', undefined, 100)]);

    expect(yAxis[0].min).toBeUndefined();
    expect(yAxis[0].max).toBe(100);
  });

  it('omits Min/Max when neither is configured', () => {
    const { yAxis } = build([field('a', 'bytes')]);

    expect(yAxis[0].min).toBeUndefined();
    expect(yAxis[0].max).toBeUndefined();
  });

  it('reads Min/Max from the representative field of a unit group', () => {
    // Both fields share the empty-unit group; the first is representative.
    const { yAxis } = build([fieldWithBounds('a', -5, 5), fieldWithBounds('b', 0, 100)]);

    expect(yAxis).toHaveLength(1);
    expect(yAxis[0].min).toBe(-5);
    expect(yAxis[0].max).toBe(5);
  });

  it('formats each axis with its own unit formatter', () => {
    const { yAxis } = build([field('a', 'percent'), field('b', 'bytes')]);

    const percentFormatter = yAxis[0].axisLabel?.formatter as (value: number) => string;
    expect(percentFormatter(50)).toContain('%');
  });

  it('sends all auto-placed units to autoSide when provided (overlay default)', () => {
    // The heatmap overlay passes `right` so its axes clear the bucket axis; even
    // the first unit lands on the right instead of the usual left.
    const { yAxis, seriesYAxisIndex } = buildCartesianYAxes({
      fields: [field('a', 'bytes'), field('b', 'percent')],
      baseYAxis,
      axisStyle,
      theme,
      fallbackFormatter: fallback,
      autoSide: 'right',
    });

    expect(yAxis).toHaveLength(2);
    expect(yAxis[0].position).toBe('right');
    expect(yAxis[1].position).toBe('right');
    expect(yAxis.map((axis) => axis.offset)).toEqual([0, AXIS_OFFSET_STEP]);
    expect(seriesYAxisIndex).toEqual([0, 1]);
  });

  it('offsets left axes past an initial (reserved) left axis and counts it', () => {
    // initialLeftCount reserves the heatmap bucket's left slot, so an explicit
    // Left overlay axis stacks outboard of it.
    const { yAxis, leftAxisCount } = buildCartesianYAxes({
      fields: [field('a', 'bytes', AxisPlacement.Left)],
      baseYAxis,
      axisStyle,
      theme,
      fallbackFormatter: fallback,
      initialLeftCount: 1,
    });

    expect(yAxis[0].position).toBe('left');
    expect(yAxis[0].offset).toBe(AXIS_OFFSET_STEP);
    expect(leftAxisCount).toBe(2);
    expect(getAxisGridSpacing({ leftAxisCount, rightAxisCount: 0 }).left).toBe(AXIS_OFFSET_STEP);
  });

  it('does not draw split lines when a side is pre-occupied by an initial axis', () => {
    // The reserved (bucket) axis owns the grid split lines, so overlay axes stay
    // clear to avoid a doubled grid.
    const { yAxis } = buildCartesianYAxes({
      fields: [field('a', 'bytes')],
      baseYAxis,
      axisStyle,
      theme,
      fallbackFormatter: fallback,
      autoSide: 'right',
      initialLeftCount: 1,
    });

    expect(yAxis[0].splitLine?.show).toBe(false);
  });
});

describe('getAxisGridSpacing', () => {
  it('reserves offset space per extra axis beyond the first on each side', () => {
    expect(getAxisGridSpacing({ leftAxisCount: 1, rightAxisCount: 1 })).toEqual({ left: 0, right: 0 });
    expect(getAxisGridSpacing({ leftAxisCount: 2, rightAxisCount: 3 })).toEqual({
      left: AXIS_OFFSET_STEP,
      right: 2 * AXIS_OFFSET_STEP,
    });
  });
});

describe('buildCartesianYAxes: core axis options', () => {
  const withCustom = (name: string, custom: object, unit?: string): Field =>
    toDataFrame({ fields: [{ name, type: FieldType.number, values: [1, 2], config: { unit, custom } }] }).fields[0];

  it('includes zero on a bar axis, as core Bar chart, and fits a line axis', () => {
    const bar = field('bar');
    const line = field('line', 'ms');
    const { yAxis } = buildCartesianYAxes({
      fields: [bar, line],
      baseYAxis,
      axisStyle,
      theme,
      fallbackFormatter: fallback,
      barFields: new Set([bar]),
    });
    expect(yAxis[0]).toMatchObject({ scale: false });
    expect(yAxis[1]).toMatchObject({ scale: true });
  });

  it('puts percent-stacked bars on one 0% to 100% axis, whatever their units', () => {
    const a = field('a', 'ms');
    const b = field('b', 'bytes');
    const { yAxis, seriesYAxisIndex } = buildCartesianYAxes({
      fields: [a, b],
      baseYAxis,
      axisStyle,
      theme,
      fallbackFormatter: fallback,
      percentFields: new Set([a, b]),
    });
    expect(yAxis).toHaveLength(1);
    expect(seriesYAxisIndex).toEqual([0, 0]);
    expect(yAxis[0]).toMatchObject({ min: 0, max: 1 });
    const formatter = yAxis[0].axisLabel?.formatter as (value: number) => string;
    expect(formatter(0.5)).toBe('50%');
  });

  it('draws the axis label, series color and border, and moves the axes to x for horizontal bars', () => {
    const a = withCustom('a', { axisLabel: 'Spend', axisColorMode: AxisColorMode.Series, axisBorderShow: true });
    const { yAxis, leftNameCount } = buildCartesianYAxes({
      fields: [a],
      baseYAxis,
      axisStyle,
      theme,
      fallbackFormatter: fallback,
      horizontal: true,
      colorOf: () => '#ff0000',
    });
    expect(yAxis[0]).toMatchObject({
      position: 'bottom',
      name: 'Spend',
      nameRotate: 0,
      axisLabel: { color: '#ff0000' },
      axisLine: { show: true, lineStyle: { color: '#ff0000' } },
    });
    expect(leftNameCount).toBe(1);
    expect(getAxisGridSpacing({ leftAxisCount: 1, rightAxisCount: 0, leftNameCount: 1 }).left).toBeGreaterThan(0);
  });

  it('hides the grid lines with "Show grid lines: Off"', () => {
    const { yAxis } = build([withCustom('a', { axisGridShow: false })]);
    expect(yAxis[0].splitLine).toMatchObject({ show: false });
  });
});

describe('buildCartesianYAxes: percent stacking', () => {
  const percentAxes = (fields: Field[], percentFields: Field[]) =>
    buildCartesianYAxes({
      fields,
      baseYAxis,
      axisStyle,
      theme,
      fallbackFormatter: fallback,
      percentFields: new Set(percentFields),
    });
  const ends = (axis: { min?: unknown; max?: unknown }, extent: { min: number; max: number }) =>
    [axis.min, axis.max].map((value) => (typeof value === 'function' ? value(extent) : value));

  it('draws only stacked fields on a fixed 0% to 100% axis', () => {
    const a = field('a');
    const b = field('b');
    const { yAxis, seriesYAxisIndex } = percentAxes([a, b], [a, b]);
    expect(yAxis).toHaveLength(1);
    expect(seriesYAxisIndex).toEqual([0, 0]);
    expect(ends(yAxis[0], { min: 0.2, max: 0.9 })).toEqual([0, 1]);
  });

  it('draws a field that does not stack, with the unit of a stacked field, on the percent axis (#504)', () => {
    const a = field('a');
    const b = field('b');
    const c = field('c');
    const { yAxis, seriesYAxisIndex } = percentAxes([a, b, c], [a, b]);
    expect(yAxis).toHaveLength(1);
    expect(seriesYAxisIndex).toEqual([0, 0, 0]);
    // As core: 0% and 100% are soft limits, so the axis grows to the raw value 3 (300%).
    expect(ends(yAxis[0], { min: 0.2, max: 3 })).toEqual([0, 3]);
    expect(ends(yAxis[0], { min: 0.2, max: 0.5 })).toEqual([0, 1]);
    const formatter = (yAxis[0].axisLabel as { formatter: (value: number) => string }).formatter;
    expect(formatter(3)).toBe('300%');
  });

  it('gives a field that does not stack, with a different unit, its own axis', () => {
    const a = field('a');
    const c = field('c', 'ms');
    const { yAxis, seriesYAxisIndex } = percentAxes([a, c], [a]);
    expect(yAxis).toHaveLength(2);
    expect(seriesYAxisIndex).toEqual([0, 1]);
  });
});

describe('getAxisRange', () => {
  const extent = { min: 5, max: 50 };
  const end = (value: unknown) => (typeof value === 'function' ? value(extent) : value);

  it('extends the data range to the soft min and max', () => {
    const range = getAxisRange({ custom: { axisSoftMin: 0, axisSoftMax: 100 }, includeZero: false, percent: false });
    expect([end(range.min), end(range.max)]).toEqual([0, 100]);
  });

  it('lets explicit Min/Max win over soft limits', () => {
    const range = getAxisRange({ min: 2, max: 9, custom: { axisSoftMax: 100 }, includeZero: true, percent: false });
    expect([range.min, range.max]).toEqual([2, 9]);
  });

  it('centers zero', () => {
    const range = getAxisRange({ custom: { axisCenteredZero: true }, includeZero: false, percent: false });
    expect([end(range.min), end(range.max)]).toEqual([-50, 50]);
  });

  it('draws a log axis, which never includes zero', () => {
    const range = getAxisRange({
      custom: { scaleDistribution: { type: ScaleDistribution.Log, log: 10 } },
      includeZero: true,
      percent: false,
    });
    expect(range).toMatchObject({ type: 'log', logBase: 10 });
    expect(range).not.toHaveProperty('scale');
  });
});
