// The marker symbols of core Geomap, as ECharts symbols.
// Core draws them with OpenLayers `WebGLPointsLayer` (`getWebGLStyle`):
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/style/markers.ts
// ECharts `path://` symbols: https://echarts.apache.org/en/option.html#series-scatter.symbol

/** The kind of symbol: how core draws it. */
export type MarkerSymbolKind = 'circle' | 'shape' | 'icon';

/** An ECharts symbol that fills a box of `2 * size` px, with the marker position at the center of the box. */
export interface MarkerSymbol {
  symbol: string;
  kind: MarkerSymbolKind;
}

// ECharts scales the bounds of a path to the symbol box. Each path starts with a move to two opposite corners, so
// the bounds are the full box and the marker position is its center.
const BOX = 'M-1 -1M1 1';
// The 24 by 24 viewBox of the core icon files in `public/img/icons/marker/`.
const ICON_BOX = 'M0 0M24 24';

const SHAPES: Record<string, string> = {
  // OpenLayers `RegularShape` of 4 points at the angle π/4, of radius `size`.
  'img/icons/marker/square.svg': `${BOX}M-0.70711 -0.70711L0.70711 -0.70711L0.70711 0.70711L-0.70711 0.70711Z`,
  // `RegularShape` of 3 points at the angle 0: the top point is `size` px above the marker position.
  'img/icons/marker/triangle.svg': `${BOX}M0 -1L0.86603 0.5L-0.86603 0.5Z`,
};

// The path data of the core icon files. Core draws each file as an image of `2 * size` px, in the marker color.
const ICONS: Record<string, string> = {
  'img/icons/marker/star.svg':
    'M22,9.67A1,1,0,0,0,21.14,9l-5.69-.83L12.9,3a1,1,0,0,0-1.8,0L8.55,8.16,2.86,9a1,1,0,0,0-.81.68,1,1,0,0,0,.25,1l4.13,4-1,5.68a1,1,0,0,0,.4,1,1,1,0,0,0,1.05.07L12,18.76l5.1,2.68a.93.93,0,0,0,.46.12,1,1,0,0,0,.59-.19,1,1,0,0,0,.4-1l-1-5.68,4.13-4A1,1,0,0,0,22,9.67Zm-6.15,4a1,1,0,0,0-.29.89l.72,4.19-3.76-2a1,1,0,0,0-.94,0l-3.76,2,.72-4.19a1,1,0,0,0-.29-.89l-3-3,4.21-.61a1,1,0,0,0,.76-.55L12,5.7l1.88,3.82a1,1,0,0,0,.76.55l4.21.61Z',
  'img/icons/marker/cross.svg': 'M19,11H13V5a1,1,0,0,0-2,0v6H5a1,1,0,0,0,0,2h6v6a1,1,0,0,0,2,0V13h6a1,1,0,0,0,0-2Z',
  'img/icons/marker/x-mark.svg':
    'M13.41,12l6.3-6.29a1,1,0,1,0-1.42-1.42L12,10.59,5.71,4.29A1,1,0,0,0,4.29,5.71L10.59,12l-6.3,6.29a1,1,0,0,0,0,1.42,1,1,0,0,0,1.42,0L12,13.41l6.29,6.3a1,1,0,0,0,1.42,0,1,1,0,0,0,0-1.42Z',
  'img/icons/marker/plane.svg':
    'M21.75,12a1,1,0,0,0-.55-.89L15.08,8.05v-4a3.08,3.08,0,1,0-6.16,0v4L2.8,11.11a1,1,0,0,0-.55.89v3.33a1,1,0,0,0,.43.83,1,1,0,0,0,.92.11l5.32-2V18l-1.82.6a1,1,0,0,0-.68.95V22a1,1,0,0,0,.3.71,1,1,0,0,0,.7.29h9.17a1,1,0,0,0,1-1V19.5a1,1,0,0,0-.68-.95L15.08,18V14.28l5.32,2a1,1,0,0,0,.92-.11,1,1,0,0,0,.43-.83Zm-7.31-.1a1,1,0,0,0-.93.11,1,1,0,0,0-.43.82v5.84a1,1,0,0,0,.69.95l1.81.6V21H8.41v-.78l1.81-.6a1,1,0,0,0,.69-.95V12.83a1,1,0,0,0-.43-.82,1,1,0,0,0-.93-.11l-5.31,2V12.62l6.11-3.06a1,1,0,0,0,.56-.89V4.08a1.08,1.08,0,1,1,2.16,0V8.67a1,1,0,0,0,.56.89l6.11,3.06v1.27Z',
};

/**
 * The ECharts symbol of a core symbol path. The circle, and a path that is not a core marker file, give a circle.
 * Core loads other SVG files from the Grafana server; this panel does not (see `parity.md`).
 */
export function getMarkerSymbol(path?: string): MarkerSymbol {
  if (path && SHAPES[path]) {
    return { symbol: `path://${SHAPES[path]}`, kind: 'shape' };
  }
  if (path && ICONS[path]) {
    return { symbol: `path://${ICON_BOX}${ICONS[path]}`, kind: 'icon' };
  }
  return { symbol: 'circle', kind: 'circle' };
}
