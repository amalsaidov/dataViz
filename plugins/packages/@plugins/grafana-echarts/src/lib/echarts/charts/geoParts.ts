import { type ChartModule } from './types';

// This file has no runtime imports. The async `geo-basemap` chunk imports it, and it then adds only this small
// module to that chunk, not the chart modules of the shared Panel chunk.

/** The parts of the geo chart module that the geo panel registers from its async chunk. */
export type GeoChartParts = Pick<ChartModule, 'buildOption' | 'getSettledResizeOption' | 'getMarkerLegends'>;

let geoParts: GeoChartParts | undefined;

/**
 * Set the option builder of the geo family. `lib/echarts/geo/chart.ts` calls it from the async `geo-basemap`
 * chunk. Thus the location matchers, the gazetteer and the basemap data stay out of the shared Panel chunk.
 */
export function registerGeoChartParts(parts: GeoChartParts): void {
  geoParts = parts;
}

/** The registered geo parts, or `undefined` before the geo panel registers them. */
export function getGeoChartParts(): GeoChartParts | undefined {
  return geoParts;
}
