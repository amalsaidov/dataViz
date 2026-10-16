import { type FieldConfigSource } from '@grafana/data';
import { type PanelOptions } from 'types';
import { isSeriesTypesOptionShown, showIfBarOption, showIfSeriesTypes } from './series-types';

const options = (seriesType?: string, histogram?: boolean) => ({ seriesType, histogram }) as PanelOptions;
const fieldConfig = (value?: string): FieldConfigSource => ({
  defaults: {},
  overrides:
    value === undefined
      ? []
      : [{ matcher: { id: 'byName', options: 'cpu' }, properties: [{ id: 'custom.seriesType', value }] }],
});
const context = { fieldConfig: fieldConfig() };

describe('isSeriesTypesOptionShown', () => {
  it('shows the option for each series type in the set, and hides it for the others', () => {
    for (const seriesType of ['line', 'bar', 'scatter', 'effectScatter', 'candlestick', 'boxplot']) {
      const shown = ['bar', 'scatter'].includes(seriesType);
      expect(isSeriesTypesOptionShown(options(seriesType), ['bar', 'scatter'], {}, context)).toBe(shown);
    }
  });

  it('treats unset and Auto as line', () => {
    for (const seriesType of ['Auto', undefined]) {
      expect(isSeriesTypesOptionShown(options(seriesType), ['line'], {}, context)).toBe(true);
      expect(isSeriesTypesOptionShown(options(seriesType), ['bar'], {}, context)).toBe(false);
    }
  });

  it('gives the histogram result in histogram mode, for each series type', () => {
    for (const seriesType of ['bar', 'line', 'scatter']) {
      expect(isSeriesTypesOptionShown(options(seriesType, true), ['bar'], {}, context)).toBe(false);
      expect(isSeriesTypesOptionShown(options(seriesType, true), ['bar'], { histogram: true }, context)).toBe(true);
    }
    expect(isSeriesTypesOptionShown(options('bar', true), ['bar'], {})).toBe(false);
    expect(isSeriesTypesOptionShown(options('bar', false), ['bar'], {}, context)).toBe(true);
  });

  it('shows the option when a field override sets a series type in the set', () => {
    expect(isSeriesTypesOptionShown(options('line'), ['bar'], {}, { fieldConfig: fieldConfig('bar') })).toBe(true);
    expect(isSeriesTypesOptionShown(options('line'), ['bar'], {}, { fieldConfig: fieldConfig('scatter') })).toBe(false);
  });

  it('shows the option when the host gives no field config (Grafana 13.2 and older)', () => {
    expect(isSeriesTypesOptionShown(options('line'), ['bar'])).toBe(true);
    expect(isSeriesTypesOptionShown(options('line'), ['bar'], {}, {})).toBe(true);
  });
});

describe('showIfSeriesTypes', () => {
  it('reads the context from the fourth argument', () => {
    expect(showIfBarOption(options('line'), [], [], context)).toBe(false);
    expect(showIfBarOption(options('line'), [], [], { fieldConfig: fieldConfig('bar') })).toBe(true);
  });

  it('has a length of 1, so the viz-options.json build does not read it as a condition on the data', () => {
    expect(showIfBarOption.length).toBe(1);
    expect(showIfSeriesTypes(['line'], { histogram: true }).length).toBe(1);
  });
});
