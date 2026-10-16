import { coordsFrame, geoContext } from 'test/geo';
import { geoChartModule } from './geo';

describe('geoChartModule.getZoomAction', () => {
  const frames = [coordsFrame([[5, 5]])];

  it('scales the geo component one OpenLayers zoom level per click when showZoom is unset', () => {
    expect(geoChartModule.getZoomAction?.(geoContext(frames))).toMatchObject({
      type: 'geoRoam',
      geoIndex: 0,
      zoomStep: 2,
    });
  });

  it('draws no buttons when showZoom is off', () => {
    expect(geoChartModule.getZoomAction?.(geoContext(frames, { controls: { showZoom: false } }))).toBeUndefined();
  });
});
