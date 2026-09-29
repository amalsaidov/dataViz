// The fixed styles of the geo panel, from the Grafana theme.
import { type GrafanaTheme2 } from '@grafana/data';

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
