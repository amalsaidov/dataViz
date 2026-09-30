import {
  getGeoJsonSource,
  isGeoJsonSourceSettled,
  loadGeoJsonSource,
  resolveGeoJsonUrl,
  setGeoJsonSource,
} from './geojsonSource';

const collection = { type: 'FeatureCollection', features: [] };

describe('GeoJSON sources', () => {
  it('resolves a public path below the Grafana public path, and keeps an absolute URL, as core', () => {
    expect(resolveGeoJsonUrl('public/maps/usa-states.geojson', '/grafana/public/')).toBe(
      '/grafana/public/maps/usa-states.geojson'
    );
    expect(resolveGeoJsonUrl('https://example.com/a.geojson', '/public/')).toBe('https://example.com/a.geojson');
  });

  it('fetches a file one time, also for two calls before it settles', async () => {
    const fetchJson = jest.fn(() => Promise.resolve(collection));
    expect(isGeoJsonSourceSettled('a')).toBe(false);
    await Promise.all([loadGeoJsonSource('a', fetchJson), loadGeoJsonSource('a', fetchJson)]);
    await loadGeoJsonSource('a', fetchJson);
    expect(fetchJson).toHaveBeenCalledTimes(1);
    expect(getGeoJsonSource('a')).toEqual(collection);
  });

  it('settles a failed fetch and a file that is not a feature collection with no data', async () => {
    await loadGeoJsonSource('b', () => Promise.reject(new Error('404')));
    await loadGeoJsonSource('c', () => Promise.resolve({ type: 'Topology' }));
    expect([isGeoJsonSourceSettled('b'), getGeoJsonSource('b')]).toEqual([true, undefined]);
    expect([isGeoJsonSourceSettled('c'), getGeoJsonSource('c')]).toEqual([true, undefined]);
  });

  it('adds a file that needs no fetch', () => {
    setGeoJsonSource('d', collection);
    expect(getGeoJsonSource('d')).toEqual(collection);
  });
});
