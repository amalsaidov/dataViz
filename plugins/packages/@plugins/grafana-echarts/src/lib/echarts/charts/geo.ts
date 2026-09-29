import { DEFAULT_CHART_LEGEND } from 'lib/echarts/options/legend';
import { type ChartModule } from './types';

/**
 * Geo chart family. This module is the routing target only: it draws nothing yet.
 * The map and the markers come in issues #361 and #362 of the geo epic (#29).
 * A null option is the generic "no chart" fallback of `ChartModule.buildOption`.
 */
export const geoChartModule: ChartModule = {
  legend: DEFAULT_CHART_LEGEND,
  buildOption: () => null,
  buildLegendItems: () => [],
};
