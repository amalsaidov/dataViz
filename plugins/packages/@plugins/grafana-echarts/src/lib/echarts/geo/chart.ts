// The geo chart parts, in the async `geo-basemap` chunk of the geo panel. `src/modules/geo/module.tsx` loads it.
import { registerGeoChartParts } from 'lib/echarts/charts/geoParts';
import { type ChartContext } from 'lib/echarts/charts/types';
import { getHeatmapLayers } from 'lib/grafana/geo/heatmap';
import { getMarkerLegends } from 'lib/grafana/geo/legend';
import { getMarkerLayers } from 'lib/grafana/geo/markers';
import { getBasemapStyle } from 'lib/grafana/geo/style';
import { resolveCoreMapView } from 'lib/grafana/geo/view';
import { registerBasemap } from './basemap';
import { buildGeoComponent, buildGeoOption, type GeoMarkersInput } from './markers';
import { type ViewSize } from './view';

/** The markers input of a render, from the frames, the core panel options and the theme. */
function toMarkersInput(ctx: ChartContext, size: ViewSize): GeoMarkersInput {
  return {
    layers: getMarkerLayers(ctx.frames, ctx.options.layers, ctx.theme, ctx.queryRefIds),
    heatmaps: getHeatmapLayers(ctx.frames, ctx.options.layers, ctx.theme, ctx.queryRefIds),
    view: resolveCoreMapView(ctx.options.view),
    size,
    // Core: on when unset.
    mouseWheelZoom: ctx.options.controls?.mouseWheelZoom !== false,
    basemapStyle: getBasemapStyle(ctx.theme),
    tooltip: { theme: ctx.theme, timeZone: ctx.timeZone, tooltipSink: ctx.tooltipSink },
  };
}

/** Register the basemap and the option builder of the geo family. A second call has no new effect. */
export function registerGeoChart(): void {
  registerBasemap();
  registerGeoChartParts({
    // The zoom needs the panel size. With no size, nothing is drawn.
    buildOption: (ctx, { plotWidth, plotHeight }) =>
      plotWidth && plotHeight ? buildGeoOption(toMarkersInput(ctx, { width: plotWidth, height: plotHeight })) : null,
    // After a resize, the view keeps the core zoom: OpenLayers keeps the px per degree, not the world fit.
    getMarkerLegends: (ctx) => getMarkerLegends(ctx.frames, ctx.options.layers, ctx.theme, ctx.queryRefIds),
    getSettledResizeOption: (ctx, { plotWidth, plotHeight }) => ({
      geo: buildGeoComponent(toMarkersInput(ctx, { width: plotWidth, height: plotHeight })),
    }),
  });
}
