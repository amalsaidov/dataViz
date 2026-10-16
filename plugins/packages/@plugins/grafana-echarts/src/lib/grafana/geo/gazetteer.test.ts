import { COUNTRIES_GAZETTEER_PATH, getGazetteer, loadWorldmapPoints, USA_STATES_GAZETTEER_PATH } from './gazetteer';

describe('getGazetteer', () => {
  it('defaults to the countries file', () => {
    expect(getGazetteer()?.path).toBe(COUNTRIES_GAZETTEER_PATH);
    expect(getGazetteer('')?.path).toBe(COUNTRIES_GAZETTEER_PATH);
  });

  it('finds a country by 2-letter code, 3-letter code, name and lower-case code', () => {
    const gazetteer = getGazetteer(COUNTRIES_GAZETTEER_PATH)!;
    const andorra = [1.601554, 42.546245];
    expect(gazetteer.find('AD')).toEqual(andorra);
    expect(gazetteer.find('AND')).toEqual(andorra);
    expect(gazetteer.find('Andorra')).toEqual(andorra);
    expect(gazetteer.find('ad')).toEqual(andorra);
    expect(gazetteer.find('Nowhere')).toBeUndefined();
  });

  it('finds a US state by code', () => {
    const gazetteer = getGazetteer(USA_STATES_GAZETTEER_PATH)!;
    expect(gazetteer.find('AK')).toEqual([-152.2683, 61.385]);
    expect(gazetteer.find('Alaska')).toEqual([-152.2683, 61.385]);
  });

  it('accepts the build URL and the legacy relative path of a bundled file', () => {
    expect(getGazetteer('/public/build/gazetteer/usa-states.json')?.path).toBe(USA_STATES_GAZETTEER_PATH);
    expect(getGazetteer('public/gazetteer/usa-states.json')?.path).toBe(USA_STATES_GAZETTEER_PATH);
  });

  it('returns undefined for a custom URL', () => {
    expect(getGazetteer('https://example.com/places.json')).toBeUndefined();
    expect(getGazetteer('https://example.com/gazetteer/countries.json')).toBeUndefined();
    expect(getGazetteer('public/gazetteer/airports.geojson')).toBeUndefined();
  });
});

describe('loadWorldmapPoints', () => {
  it('indexes name, key and keys', () => {
    const gazetteer = loadWorldmapPoints('p', [
      { key: 'k1', keys: ['a', 'b'], name: 'Place', latitude: 1, longitude: 2 },
    ]);
    for (const key of ['k1', 'a', 'b', 'Place', 'PLACE']) {
      expect(gazetteer.find(key)).toEqual([2, 1]);
    }
  });
});
