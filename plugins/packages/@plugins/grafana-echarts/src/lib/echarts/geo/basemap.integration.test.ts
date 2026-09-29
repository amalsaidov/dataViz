import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getMap } from 'echarts/core';
import { BASEMAP_NAME, registerBasemap } from './basemap';

// The decoded TopoJSON basemap against its raw source, `data/countries.geojson`.
// The simplification (0.1 degree) and the quantization (1e4) move a bounding box edge by 0.15 degree at most.
const BBOX_TOLERANCE_DEGREES = 0.2;

interface Feature {
  id?: string;
  properties: { name: string };
  geometry: { coordinates: unknown };
}

/** `[minLon, minLat, maxLon, maxLat]` of the nested coordinates of a geometry. */
function bbox(coordinates: unknown): number[] {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (value: unknown): void => {
    if (!Array.isArray(value)) {
      return;
    }
    if (typeof value[0] === 'number') {
      box[0] = Math.min(box[0], value[0]);
      box[1] = Math.min(box[1], value[1]);
      box[2] = Math.max(box[2], value[0]);
      box[3] = Math.max(box[3], value[1]);
      return;
    }
    value.forEach(visit);
  };
  visit(coordinates);
  return box;
}

describe('registerBasemap decode', () => {
  registerBasemap();
  const decoded = (getMap(BASEMAP_NAME) as { geoJSON: { features: Feature[] } }).geoJSON.features;
  const raw: Feature[] = JSON.parse(readFileSync(join(__dirname, 'data', 'countries.geojson'), 'utf8')).features;

  it('keeps each feature, in the same order', () => {
    expect(decoded.map((f) => [f.id, f.properties.name])).toEqual(raw.map((f) => [f.id, f.properties.name]));
  });

  it('keeps the bounding box of each feature', () => {
    raw.forEach((feature, index) => {
      const expected = bbox(feature.geometry.coordinates);
      const actual = bbox(decoded[index].geometry.coordinates);
      actual.forEach((value, k) => expect(Math.abs(value - expected[k])).toBeLessThanOrEqual(BBOX_TOLERANCE_DEGREES));
    });
  });
});
