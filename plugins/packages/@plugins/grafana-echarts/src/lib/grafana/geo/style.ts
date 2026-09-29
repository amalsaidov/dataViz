// The fixed styles of the geo panel, from the Grafana theme.
import { colorManipulator, type GrafanaTheme2 } from '@grafana/data';

/** The colors and size of a marker, as CSS colors and px. */
export interface MarkerStyle {
  fill: string;
  stroke: string;
  lineWidth: number;
  /** The circle radius in px. */
  radius: number;
}

/**
 * The fixed style of core `defaultStyleConfig`: a circle of radius 5, `dark-green` at opacity 0.4, with a stroke of
 * width 1. Core `circleMarker` applies the opacity to the fill only.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/style/types.ts
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/style/markers.ts
 */
export function getDefaultMarkerStyle(theme: GrafanaTheme2): MarkerStyle {
  const color = theme.visualization.getColorByName('dark-green');
  return { fill: colorManipulator.alpha(color, 0.4), stroke: color, lineWidth: 1, radius: 5 };
}

/** The colors of the country shapes, as CSS colors. */
export interface BasemapStyle {
  area: string;
  border: string;
}

/**
 * The colors of the vector basemap. Core draws raster tiles (CARTO), which have no Grafana theme colors. These
 * theme colors give a quiet basemap of the same kind in the light and dark themes.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/themes/createColors.ts
 */
export function getBasemapStyle(theme: GrafanaTheme2): BasemapStyle {
  return { area: theme.colors.background.secondary, border: theme.colors.border.medium };
}
