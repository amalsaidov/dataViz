import { type FieldConfigSource, type PanelOptionsEditorBuilder } from '@grafana/data';
import { addPerformanceOptions } from 'lib/grafana/editor/common/performance-options';
import { type PanelOptions } from 'types';
import { addCartesianFillOpacityOptions } from './fill-opacity';
import { addCartesianPointSizeOptions } from './point-size';
import { showIfLineOption } from './series-types';

// The showIf of each line-only cartesian option (#793).
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
  addBooleanSwitch: record,
} as unknown as PanelOptionsEditorBuilder<PanelOptions>;
addCartesianFillOpacityOptions(builder);
addCartesianPointSizeOptions(builder);
addPerformanceOptions(builder, showIfLineOption);
const showIfOf = (path: string) => items.find((item) => item.path === path)!.showIf!;
const fieldConfig = (value?: string): FieldConfigSource => ({
  defaults: {},
  overrides:
    value === undefined
      ? []
      : [{ matcher: { id: 'byName', options: 'cpu' }, properties: [{ id: 'custom.seriesType', value }] }],
});
const shown = (path: string, options: Partial<PanelOptions>, override?: string) =>
  showIfOf(path)({ editorMode: 'advanced', ...options } as PanelOptions, [], [], {
    fieldConfig: fieldConfig(override),
  });

const seriesTypes = ['Auto', 'line', 'bar', 'scatter', 'effectScatter', 'candlestick', 'boxplot'];
const cases: Array<[string, string[]]> = [
  ['fillOpacity', ['Auto', 'line']],
  ['pointSize', ['Auto', 'line', 'scatter', 'effectScatter']],
  ['performance.showPoints', ['Auto', 'line']],
  ['performance.downsampling', ['Auto', 'line']],
];

describe.each(cases)('%s', (path, types) => {
  it('shows only for its series types', () => {
    for (const seriesType of seriesTypes) {
      expect(shown(path, { seriesType } as Partial<PanelOptions>)).toBe(types.includes(seriesType));
    }
  });

  it('hides in histogram mode', () => {
    expect(shown(path, { seriesType: 'line', histogram: true } as Partial<PanelOptions>)).toBe(false);
  });

  it('shows when a field override sets a line series', () => {
    expect(shown(path, { seriesType: 'bar' } as Partial<PanelOptions>, 'line')).toBe(true);
  });
});

it('keeps the Advanced condition of Downsampling', () => {
  const showIf = showIfOf('performance.downsampling');
  expect(showIf({ seriesType: 'line', editorMode: 'default' } as unknown as PanelOptions, [], [])).toBe(false);
});
