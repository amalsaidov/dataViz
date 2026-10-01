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
  // A frame with no location field shows the Grafana error view (#864).
  getDataIssue: (ctx) => getGeoChartParts()?.getDataIssue?.(ctx),
  // The core Geomap `tooltip.mode`: `details` (the default) or `none`.
  getTooltipOption: (ctx) => buildGeoTooltipOption(ctx.options.tooltip?.mode),
  getSettledResizeOption: (ctx, dimensions) => getGeoChartParts()?.getSettledResizeOption?.(ctx, dimensions),
  getMarkerLegends: (ctx) => getGeoChartParts()?.getMarkerLegends?.(ctx) ?? [],
  // The core `controls.showZoom` (on when unset). The buttons scale the `geo` component, and the reset
  // writes the start view of the panel options again.
  // https://echarts.apache.org/en/api.html#action.geo.geoRoam
  getZoomAction: (ctx) =>
    ctx.options.controls?.showZoom === false
      ? undefined
      : {
          type: 'geoRoam',
          geoIndex: 0,
          // One click is one OpenLayers zoom level, as the core Zoom control (`delta: 1`).
          // https://openlayers.org/en/latest/apidoc/module-ol_control_Zoom-Zoom.html
          zoomStep: 2,
          getResetOption: ({ width, height }) =>
            getGeoChartParts()?.getSettledResizeOption?.(ctx, { plotWidth: width, plotHeight: height }),
        },
};
