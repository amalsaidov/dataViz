import { buildGeoTooltipOption } from 'lib/echarts/geo/tooltip';
import { DEFAULT_CHART_LEGEND } from 'lib/echarts/options/legend';
import { getGeoChartParts } from './geoParts';
import { type ChartModule } from './types';

/**
 * Geo chart family: markers of one fixed style on the vector basemap (epic #29). The geo panel registers the
 * builder (see `geoParts.ts`). Before that, a null option is the generic "no chart" fallback of
 * `ChartModule.buildOption`.
 */
export const geoChartModule: ChartModule = {
  legend: DEFAULT_CHART_LEGEND,
  buildOption: (ctx, base) => getGeoChartParts()?.buildOption(ctx, base) ?? null,
  buildLegendItems: () => [],
  // The core Geomap `tooltip.mode`: `details` (the default) or `none`.
  getTooltipOption: (ctx) => buildGeoTooltipOption(ctx.options.tooltip?.mode),
  getSettledResizeOption: (ctx, dimensions) => getGeoChartParts()?.getSettledResizeOption?.(ctx, dimensions),
};
