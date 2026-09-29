// The geo chart parts, in the async `geo-basemap` chunk of the geo panel. `src/modules/geo/module.tsx` loads it.
import { registerGeoChartParts } from 'lib/echarts/charts/geoParts';
import { type ChartContext } from 'lib/echarts/charts/types';
import { getMarkerPositions } from 'lib/grafana/geo/markers';
import { getBasemapStyle, getDefaultMarkerStyle } from 'lib/grafana/geo/style';
import { resolveCoreMapView } from 'lib/grafana/geo/view';
import { registerBasemap } from './basemap';
import { buildGeoComponent, buildGeoOption, type GeoMarkersInput } from './markers';
import { type ViewSize } from './view';

/** The markers input of a render, from the frames, the core panel options and the theme. */
function toMarkersInput(ctx: ChartContext, size: ViewSize): GeoMarkersInput {
  return {
    markers: getMarkerPositions(ctx.frames, ctx.options.layers),
    view: resolveCoreMapView(ctx.options.view),
    size,
    markerStyle: getDefaultMarkerStyle(ctx.theme),
    basemapStyle: getBasemapStyle(ctx.theme),
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
    getSettledResizeOption: (ctx, { plotWidth, plotHeight }) => ({
      geo: buildGeoComponent(toMarkersInput(ctx, { width: plotWidth, height: plotHeight })),
    }),
  });
}
