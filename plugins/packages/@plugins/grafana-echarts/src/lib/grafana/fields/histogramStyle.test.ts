import { type Field, FieldType } from '@grafana/data';
import { GraphGradientMode, StackingMode } from '@grafana/schema';
import { type PanelOptions } from 'types';
import { getHistogramFieldStyles, getHistogramStackingGroups } from './histogramStyle';

const count = (config: Field['config'] = {}): Field => ({ name: 'count', type: FieldType.number, values: [1], config });
const options = (value: Partial<PanelOptions> = {}) => value as PanelOptions;

describe('getHistogramFieldStyles', () => {
  it('gives the core defaults when the field and the panel have no setting', () => {
    expect(getHistogramFieldStyles([count()], options())).toEqual([
      { stacking: StackingMode.None, group: 'A', fillOpacity: 80, lineWidth: 1, gradientMode: GraphGradientMode.None },
    ]);
  });

  it('uses the panel options when the field has no setting', () => {
    const panel = options({ stacking: StackingMode.Normal, barFillOpacity: 30, lineWidth: 4 });
    expect(getHistogramFieldStyles([count()], panel)[0]).toEqual(
      expect.objectContaining({ stacking: StackingMode.Normal, fillOpacity: 30, lineWidth: 4 })
    );
  });

  it('uses the field settings before the panel options', () => {
    const custom = {
      stacking: { mode: StackingMode.None, group: 'B' },
      fillOpacity: 0,
      lineWidth: 0,
      gradientMode: GraphGradientMode.Hue,
    };
    const panel = options({ stacking: StackingMode.Percent, barFillOpacity: 30, lineWidth: 4 });
    expect(getHistogramFieldStyles([count({ custom })], panel)).toEqual([
      { stacking: StackingMode.None, group: 'B', fillOpacity: 0, lineWidth: 0, gradientMode: GraphGradientMode.Hue },
    ]);
  });

  it('uses group A for a field with no group or an empty group', () => {
    const custom = { stacking: { mode: StackingMode.Normal, group: '' } };
    expect(getHistogramFieldStyles([count({ custom })], options())[0].group).toBe('A');
  });
});

describe('getHistogramStackingGroups', () => {
  const groupsOf = (fields: Field[], hidden: number[] = []) =>
    getHistogramStackingGroups(fields, getHistogramFieldStyles(fields, options()), (i) => hidden.includes(i));
  const stacked = (mode: StackingMode, group = 'A', config: Field['config'] = {}) =>
    count({ ...config, custom: { stacking: { mode, group } } });

  it('puts the fields with the same mode and group in one group, in the order of the fields', () => {
    const fields = [stacked(StackingMode.Normal), stacked(StackingMode.Normal, 'B'), stacked(StackingMode.Normal)];
    expect(groupsOf(fields)).toEqual([
      { mode: StackingMode.Normal, fields: [0, 2] },
      { mode: StackingMode.Normal, fields: [1] },
    ]);
  });

  it('puts the fields of one group name with a different mode in different groups', () => {
    expect(groupsOf([stacked(StackingMode.Normal), stacked(StackingMode.Percent)])).toEqual([
      { mode: StackingMode.Normal, fields: [0] },
      { mode: StackingMode.Percent, fields: [1] },
    ]);
  });

  it('puts the fields with a different scale in different groups, as core buildScaleKey', () => {
    const fields = [stacked(StackingMode.Normal), stacked(StackingMode.Normal, 'A', { unit: 'short' })];
    expect(groupsOf(fields)).toHaveLength(2);
  });

  it('puts a hidden field, and a field that does not stack, in no group', () => {
    const fields = [stacked(StackingMode.Normal), stacked(StackingMode.None), stacked(StackingMode.Normal)];
    expect(groupsOf(fields, [2])).toEqual([{ mode: StackingMode.Normal, fields: [0] }]);
  });
});
