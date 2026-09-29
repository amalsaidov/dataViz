import { decodeGeohash } from './geohash';

describe('decodeGeohash', () => {
  it('returns the cell center as [lon, lat]', () => {
    // Known cell of the Wikipedia example: https://en.wikipedia.org/wiki/Geohash
    const [lon, lat] = decodeGeohash('ezs42')!;
    expect(lon).toBeCloseTo(-5.60302734375, 10);
    expect(lat).toBeCloseTo(42.60498046875, 10);
  });

  it('narrows the cell with more characters', () => {
    const [lon, lat] = decodeGeohash('u4pruydqqvj')!;
    expect(lon).toBeCloseTo(10.407439, 5);
    expect(lat).toBeCloseTo(57.64911, 5);
  });

  it('returns undefined for an empty string', () => {
    expect(decodeGeohash('')).toBeUndefined();
  });

  it.each(['EZS42', 'ezs4a', 'ez s'])(
    'returns undefined for %s, which has a character outside the alphabet',
    (hash) => {
      expect(decodeGeohash(hash)).toBeUndefined();
    }
  );
});
