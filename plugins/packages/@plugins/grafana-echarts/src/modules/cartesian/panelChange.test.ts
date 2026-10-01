import { type PanelModel } from '@grafana/data';
import { cartesianPanelChangeHandler } from './panelChange';

const panel = (): PanelModel => ({
  id: 1,
  type: 'grafana-echartscartesian-panel',
  options: { keep: true },
  fieldConfig: { defaults: {}, overrides: [] },
});

describe('cartesianPanelChangeHandler', () => {
  it('maps the core Time series options and overrides to the cartesian panel', () => {
    const target = panel();
    const state = target.fieldConfig;
    const options = cartesianPanelChangeHandler(
      target,
      'timeseries',
      { legend: { displayMode: 'table', placement: 'right', showLegend: true, calcs: [] } },
      {
        defaults: { unit: 'percent', custom: { drawStyle: 'bars', lineWidth: 2, fillOpacity: 30, axisLabel: 'Y' } },
        overrides: [
          { matcher: { id: 'byName', options: 'b' }, properties: [{ id: 'custom.drawStyle', value: 'line' }] },
        ],
      }
    );
    expect(options).toMatchObject({
      legend: { displayMode: 'table', placement: 'right' },
      seriesType: 'bar',
      lineWidth: 2,
      fillOpacity: 30,
      barsIncludeZero: false,
    });
    // Scenes keeps its own field config object, so the handler changes it in place.
    expect(target.fieldConfig).toBe(state);
    expect(target.fieldConfig.defaults).toMatchObject({ unit: 'percent', custom: { axisLabel: 'Y' } });
    expect(target.fieldConfig.overrides).toEqual([
      { matcher: { id: 'byName', options: 'b' }, properties: [{ id: 'custom.seriesType', value: 'line' }] },
    ]);
  });

  it('changes nothing for another panel type', () => {
    const target = panel();
    expect(cartesianPanelChangeHandler(target, 'barchart', {}, { defaults: {}, overrides: [] })).toEqual({});
    expect(target.fieldConfig).toEqual({ defaults: {}, overrides: [] });
  });
});
