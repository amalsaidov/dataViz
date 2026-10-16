/**
 * Decode a geohash to the center of its cell.
 * Ported from Grafana core (AGPL-3.0):
 * https://github.com/grafana/grafana/blob/main/public/app/features/geo/format/geohash.ts
 * Geohash format: https://en.wikipedia.org/wiki/Geohash
 *
 * Returns `[longitude, latitude]` (WGS84), or `undefined` for an empty string or a character that is not
 * in the geohash alphabet. Core does not check the alphabet, and reads such a character as all bits set.
 */
export function decodeGeohash(geohash: string): [number, number] | undefined {
  if (!geohash?.length) {
    return undefined;
  }
  const BITS = [16, 8, 4, 2, 1];
  const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';
  let isEven = true;
  const lat = [-90, 90];
  const lon = [-180, 180];

  for (const char of geohash) {
    const decoded = BASE32.indexOf(char);
    if (decoded < 0) {
      return undefined;
    }
    for (const mask of BITS) {
      refineInterval(isEven ? lon : lat, decoded, mask);
      isEven = !isEven;
    }
  }

  return [(lon[0] + lon[1]) / 2, (lat[0] + lat[1]) / 2];
}

function refineInterval(interval: number[], decoded: number, mask: number) {
  if (decoded & mask) {
    interval[0] = (interval[0] + interval[1]) / 2;
  } else {
    interval[1] = (interval[0] + interval[1]) / 2;
  }
}
