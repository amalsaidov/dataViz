import { MAP_VIEW_PRESETS, OL_MAX_ZOOM, resolveCoreMapView } from './view';

describe('resolveCoreMapView', () => {
  it('has the core presets in the core order', () => {
    expect(MAP_VIEW_PRESETS.map((p) => p.id)).toEqual([
      'fit',
      'zero',
      'coords',
      'north-america',
      'south-america',
      'europe',
      'africa',
      'west-asia',
      's-asia',
      'se-asia',
      'e-asia',
      'australia',
      'oceania',
    ]);
  });

  it('starts at [0, 0], zoom 1, for no view and for an unknown id', () => {
    expect(resolveCoreMapView(undefined)).toEqual({ center: [0, 0], zoom: 1, minZoom: 0, maxZoom: OL_MAX_ZOOM });
    expect(resolveCoreMapView({ id: 'mars', zoom: 3 }).center).toEqual([0, 0]);
    expect(resolveCoreMapView({ id: 'mars', zoom: 3 }).zoom).toBe(3);
  });

  it('takes the center of a preset and the zoom of the saved view', () => {
    // The preset zoom (4) is not used: the core editor copies it into view.zoom.
    expect(resolveCoreMapView({ id: 'europe', lat: 1, lon: 2, zoom: 5 })).toMatchObject({ center: [14, 46], zoom: 5 });
    expect(resolveCoreMapView({ id: 'europe' }).zoom).toBe(1);
  });

  it('takes the center of the saved view for coords', () => {
    expect(resolveCoreMapView({ id: 'coords', lat: -33.9, lon: 151.2, zoom: 9 })).toMatchObject({
      center: [151.2, -33.9],
      zoom: 9,
    });
  });

  it('limits the zoom to minZoom and maxZoom', () => {
    expect(resolveCoreMapView({ id: 'zero', zoom: 12, maxZoom: 6 }).zoom).toBe(6);
    expect(resolveCoreMapView({ id: 'zero', zoom: 2, minZoom: 3 }).zoom).toBe(3);
  });

  it('gives the fit settings for "Fit to data", with no center', () => {
    expect(resolveCoreMapView({ id: 'fit', zoom: 15 })).toEqual({
      zoom: 1,
      minZoom: 0,
      maxZoom: OL_MAX_ZOOM,
      fit: { padding: 5, maxZoom: 15 },
    });
    expect(resolveCoreMapView({ id: 'fit', maxZoom: 10, padding: 20 }).fit).toEqual({ padding: 20, maxZoom: 10 });
  });
});
