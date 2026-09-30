import { type FieldConfigSource } from '@grafana/data';
import { type PanelOptions } from 'types';
import { isBarOptionShown, showIfBarOption } from './bar-only';

const options = (seriesType?: string) => ({ seriesType }) as PanelOptions;
const fieldConfig = (value?: string): FieldConfigSource => ({
  defaults: {},
  overrides:
    value === undefined
      ? []
      : [{ matcher: { id: 'byName', options: 'cpu' }, properties: [{ id: 'custom.seriesType', value }] }],
});

describe('isBarOptionShown', () => {
  it('shows the option when the panel series type is bar', () => {
    expect(isBarOptionShown(options('bar'), { fieldConfig: fieldConfig() })).toBe(true);
  });

  it('hides the option for the other series types when no override sets bar', () => {
    for (const seriesType of ['Auto', 'line', 'scatter', undefined]) {
      expect(isBarOptionShown(options(seriesType), { fieldConfig: fieldConfig() })).toBe(false);
    }
    expect(isBarOptionShown(options('line'), { fieldConfig: fieldConfig('scatter') })).toBe(false);
  });

  it('shows the option when a field override sets the bar series type', () => {
    expect(isBarOptionShown(options('line'), { fieldConfig: fieldConfig('bar') })).toBe(true);
  });

  it('shows the option when the host gives no field config (Grafana 13.2 and older)', () => {
    expect(isBarOptionShown(options('line'))).toBe(true);
    expect(isBarOptionShown(options('line'), {})).toBe(true);
  });
});

describe('showIfBarOption', () => {
  it('reads the context from the fourth argument', () => {
    expect(showIfBarOption(options('line'), [], [], { fieldConfig: fieldConfig() })).toBe(false);
    expect(showIfBarOption(options('line'), [], [], { fieldConfig: fieldConfig('bar') })).toBe(true);
  });

  it('has a length of 1, so the viz-options.json build does not read it as a condition on the data', () => {
    expect(showIfBarOption.length).toBe(1);
  });
});
