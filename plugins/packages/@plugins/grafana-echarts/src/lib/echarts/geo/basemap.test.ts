import { getMap } from 'echarts/core';
import { BASEMAP_NAME, registerBasemap } from './basemap';

describe('registerBasemap', () => {
  it('registers the country shapes under the basemap name', () => {
    registerBasemap();
    const map = getMap(BASEMAP_NAME) as { geoJSON?: { features: Array<{ properties: { name: string } }> } };
    expect(map.geoJSON?.features.length).toBe(179);
    expect(map.geoJSON?.features.some((f) => f.properties.name === 'Australia')).toBe(true);
  });
});
