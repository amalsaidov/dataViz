import { type GeoSeriesType } from 'editor/types';

/**
 * Series types the geo family routes on. `map` is the only token: the markers use `scatter` on a `geo`
 * component, and `scatter` belongs to the cartesian family in `resolveChartModule`.
 * https://echarts.apache.org/en/option.html#series-map
 */
export const geoSeriesTypes: GeoSeriesType[] = ['map'];
