// The vector basemap of the geo panel: the country shapes of core `public/maps/countries.geojson` (see
// `data/README.md`). Only the geo panel imports this file, from an async chunk. Thus the other panels and the
// standalone viz bundle do not get the data or `GeoComponent`.
import { GeoComponent } from 'echarts/components';
// `use` is aliased as in `lib/echarts/echarts.ts`, for the react-hooks lint rule.
import { registerMap, use as registerEChartsModules } from 'echarts/core';
import countries from './data/countries.json';

/** The map name for `geo.map`. https://echarts.apache.org/en/option.html#geo.map */
export const BASEMAP_NAME = 'grafana-countries';

type MapSource = Parameters<typeof registerMap>[1];

/** The JSON import types `type` as `string`; the check gives the GeoJSON type of `registerMap`. */
function isFeatureCollection(data: object): data is Exclude<MapSource, string> {
  return 'type' in data && data.type === 'FeatureCollection' && 'features' in data && Array.isArray(data.features);
}

/**
 * Register the `geo` coordinate system and the basemap with ECharts. A second call has no new effect.
 * https://echarts.apache.org/handbook/en/basics/import (import by parts)
 * https://echarts.apache.org/en/api.html#echarts.registerMap
 */
export function registerBasemap(): void {
  registerEChartsModules([GeoComponent]);
  if (isFeatureCollection(countries)) {
    registerMap(BASEMAP_NAME, countries);
  }
}
