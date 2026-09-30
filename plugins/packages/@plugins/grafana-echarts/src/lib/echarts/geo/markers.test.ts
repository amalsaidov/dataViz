import { resolveCoreMapView } from 'lib/grafana/geo/view';
import { buildGeoComponent, type GeoMarkersInput } from './markers';
import { toGeoZoom } from './view';

const size = { width: 800, height: 512 };

const input = (mouseWheelZoom: boolean, view = resolveCoreMapView({ id: 'zero' })): GeoMarkersInput => ({
  layers: [],
  view,
  size,
  mouseWheelZoom,
  basemapStyle: { area: '#000', border: '#fff' },
  tooltip: {} as GeoMarkersInput['tooltip'],
});

describe('buildGeoComponent', () => {
  it('pans and zooms with the mouse wheel when mouseWheelZoom is on', () => {
    expect(buildGeoComponent(input(true)).roam).toBe(true);
  });

  it('pans only when mouseWheelZoom is off, as the core DragPan interaction', () => {
    expect(buildGeoComponent(input(false)).roam).toBe('move');
  });

  it('limits the zoom to the view minZoom and maxZoom', () => {
    const view = resolveCoreMapView({ id: 'zero', minZoom: 2, maxZoom: 6 });

    expect(buildGeoComponent(input(true, view)).scaleLimit).toEqual({
      min: toGeoZoom(2, size),
      max: toGeoZoom(6, size),
    });
  });
});
