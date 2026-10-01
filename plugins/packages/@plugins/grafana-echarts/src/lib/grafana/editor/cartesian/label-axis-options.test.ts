import { type FieldConfigSource, type PanelOptionsEditorBuilder } from '@grafana/data';
import { type PanelOptions } from 'types';
import { addCartesianValueLabelOptions } from './value-labels';
import { addCartesianXTickLabelOptions } from './x-tick-labels';
import { addCartesianXTickRotateOptions } from './x-tick-rotate';

// The series type conditions of the cartesian value label and x tick options (#794).
type Item = { path: string; showIf?: (options: PanelOptions, ...rest: unknown[]) => boolean | undefined };
const items: Item[] = [];
// A builder that keeps the config of each option.
const record = (item: Item) => {
  items.push(item);
  return builder;
};
const builder = {
  addNumberInput: record,
  addRadio: record,
  addSelect: record,
} as unknown as PanelOptionsEditorBuilder<PanelOptions>;
addCartesianValueLabelOptions(builder);
addCartesianXTickRotateOptions(builder);
addCartesianXTickLabelOptions(builder);

const fieldConfig = (value?: string): FieldConfigSource => ({
  defaults: {},
  overrides:
    value === undefined
      ? []
      : [{ matcher: { id: 'byName', options: 'cpu' }, properties: [{ id: 'custom.seriesType', value }] }],
});
// Advanced mode, value labels on and rotated ticks, so only the series type condition can hide an option.
const shown = (path: string, options: object, override?: string) =>
  items.find((item) => item.path === path)!.showIf!(
    { editorMode: 'advanced', showValues: 'always', xTickRotate: 45, ...options } as unknown as PanelOptions,
    [],
    [],
    { fieldConfig: fieldConfig(override) }
  );

const seriesTypes = ['Auto', 'line', 'bar', 'scatter', 'effectScatter', 'candlestick', 'boxplot'];

describe.each(['showValues', 'valueLabelPosition'])('%s', (path) => {
  it('hides for candlestick, boxplot and histogram mode', () => {
    for (const seriesType of seriesTypes) {
      expect(shown(path, { seriesType })).toBe(!['candlestick', 'boxplot'].includes(seriesType));
    }
    expect(shown(path, { seriesType: 'bar', histogram: true })).toBe(false);
    expect(shown(path, { seriesType: 'boxplot' }, 'bar')).toBe(true);
  });
});

it('keeps the Show values condition of Value label position', () => {
  expect(shown('valueLabelPosition', { seriesType: 'bar', showValues: 'never' })).toBe(false);
});

describe.each(['xTickRotate', 'xTickLabelMaxLength', 'xTickLabelSpacing'])('%s', (path) => {
  it('shows for each series type and hides in histogram mode', () => {
    for (const seriesType of seriesTypes) {
      expect(shown(path, { seriesType })).toBe(true);
    }
    expect(shown(path, { seriesType: 'bar', histogram: true })).toBe(false);
  });
});

it('keeps the rotation condition of X-axis tick label max length', () => {
  expect(shown('xTickLabelMaxLength', { seriesType: 'bar', xTickRotate: 0 })).toBe(false);
});
