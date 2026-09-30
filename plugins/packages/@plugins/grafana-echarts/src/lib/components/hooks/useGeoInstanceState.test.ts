import { PanelContextProvider } from '@grafana/ui';
import { renderHook } from '@testing-library/react';
import React from 'react';
import { type EChartsType } from 'lib/echarts/echarts';
import { projectLonLat } from 'lib/echarts/geo/projection';
import { toGeoZoom } from 'lib/echarts/geo/view';
import { type GeoInstanceState } from 'lib/grafana/geo/view';
import { useGeoInstanceState } from './useGeoInstanceState';

const size = { width: 800, height: 400 };

/** A chart stand-in with the live `geo` component of a roamed map. */
function fakeChart(): EChartsType {
  const geo = { center: projectLonLat([10, 20]), zoom: toGeoZoom(5, size) };
  return {
    isDisposed: () => false,
    getOption: () => ({ geo: [geo] }),
    getWidth: () => size.width,
    getHeight: () => size.height,
  } as unknown as EChartsType;
}

/** Run the hook in a panel context with the instance state callback of Grafana. */
function run(chart: EChartsType | null, family: 'geo' | 'cartesian', onInstanceStateChange: jest.Mock) {
  const context = { eventsScope: 'test', eventBus: {}, onInstanceStateChange } as unknown as React.ComponentProps<
    typeof PanelContextProvider
  >['value'];
  const wrapper = ({ children }: { children: React.ReactNode }) =>
    React.createElement(PanelContextProvider, { value: context }, children);
  renderHook(() => useGeoInstanceState({ current: chart }, family), { wrapper });
}

describe('useGeoInstanceState', () => {
  it('gives the editor the live view of a geo chart in core terms', () => {
    const onInstanceStateChange = jest.fn<void, [GeoInstanceState]>();
    run(fakeChart(), 'geo', onInstanceStateChange);
    expect(onInstanceStateChange).toHaveBeenCalledTimes(1);
    expect(onInstanceStateChange.mock.calls[0][0].readMapView()).toEqual({ lon: 10, lat: 20, zoom: 5 });
  });

  it('sets no state for another family', () => {
    const onInstanceStateChange = jest.fn();
    run(fakeChart(), 'cartesian', onInstanceStateChange);
    expect(onInstanceStateChange).not.toHaveBeenCalled();
  });

  it('gives no view before the chart exists', () => {
    const onInstanceStateChange = jest.fn<void, [GeoInstanceState]>();
    run(null, 'geo', onInstanceStateChange);
    expect(onInstanceStateChange.mock.calls[0][0].readMapView()).toBeUndefined();
  });
});
