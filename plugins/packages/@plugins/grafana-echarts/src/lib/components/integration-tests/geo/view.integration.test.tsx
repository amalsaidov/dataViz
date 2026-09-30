import { render } from '@testing-library/react';
import { registerGeoChart } from 'lib/echarts/geo/chart';
import { readLiveGeoView } from 'lib/echarts/geo/liveView';
import { getChart } from 'test/canvas';
import { coordsFrame, registerTestBasemap } from 'test/geo';
import { getComponent, height, waitForFinished, width } from 'test/panel';

// Core Geomap keeps the OpenLayers view of the user across data updates. A change of the view options gives the
// start view again. https://openlayers.org/en/latest/apidoc/module-ol_View-View.html

const europe = { id: 'europe', zoom: 4 };
const panel = (points: Array<[number, number]>, view: { id: string; zoom: number } = europe) =>
  getComponent([coordsFrame(points)], 'map', { view }, undefined, undefined, 'geo');

describe('geo view retention', () => {
  beforeAll(() => {
    registerGeoChart();
    registerTestBasemap();
  });

  it('keeps the zoom and the pan of the user across new data, and resets for new view options', async () => {
    const { container, rerender } = render(panel([[46, 14]]));
    const { chart } = getChart(container);
    await waitForFinished(chart);
    const start = readLiveGeoView(chart!);

    chart!.dispatchAction({ type: 'geoRoam', geoIndex: 0, zoom: 2, originX: width / 2, originY: height / 2 });
    chart!.dispatchAction({ type: 'geoRoam', geoIndex: 0, dx: 30, dy: 20 });
    const roamed = readLiveGeoView(chart!);
    expect(roamed?.zoom).toBeCloseTo(2 * start!.zoom!);

    rerender(
      panel([
        [46, 14],
        [52.5, 13.4],
      ])
    );
    await waitForFinished(chart);
    expect(readLiveGeoView(chart!)).toEqual(roamed);

    rerender(panel([[46, 14]], { ...europe, zoom: 5 }));
    await waitForFinished(chart);
    expect(readLiveGeoView(chart!)?.zoom).toBeCloseTo(2 * start!.zoom!);
    expect(readLiveGeoView(chart!)?.center).not.toEqual(roamed?.center);
  });
});
