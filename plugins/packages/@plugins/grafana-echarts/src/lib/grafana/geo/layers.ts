// The data layer list of core Geomap (`layers`): the default list and the edits of the core layers editor.
// Core: `initMapAsync` in https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/GeomapPanel.tsx,
// `getNextLayerName` in https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/utils/utils.ts
// and `defaultMarkersConfig` in
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/markersLayer.tsx
import { type DataFrame, getFrameMatchers } from '@grafana/data';
import { FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';

/** The layer type of the core markers layer (`MARKERS_LAYER_ID`). */
export const MARKERS_LAYER_TYPE = 'markers';

/** The layer type of the core heatmap layer. */
export const HEATMAP_LAYER_TYPE = 'heatmap';

/** The layer type of the core route layer (`ROUTE_LAYER_ID`). */
export const ROUTE_LAYER_TYPE = 'route';
/** The layer type of the core GeoJSON layer. */
export const GEOJSON_LAYER_TYPE = 'geojson';

/** A new markers layer, as core `defaultMarkersConfig`. The style is unset: the default style applies. */
export const newMarkersLayer = (name: string): MapLayerOptions => ({
  type: MARKERS_LAYER_TYPE,
  name,
  config: {},
  location: { mode: FrameGeometrySourceMode.Auto },
  tooltip: true,
});

/** The layers that core draws. An unset option gives one markers layer: core sets `[defaultMarkersConfig]`. */
export const resolveLayers = (layers: MapLayerOptions[] | undefined): MapLayerOptions[] =>
  layers ?? [newMarkersLayer('Layer 1')];

/** The next free name `Layer <n>`. Core starts `n` at the count of layers plus the basemap. */
export function getNextLayerName(layers: MapLayerOptions[]): string {
  const names = new Set(layers.map((l) => l.name));
  let n = layers.length + 1;
  while (names.has(`Layer ${n}`)) {
    n++;
  }
  return `Layer ${n}`;
}

/** Add a markers layer at the end of the list. Core draws the last layer on top. */
export const addMarkersLayer = (layers: MapLayerOptions[]): MapLayerOptions[] => [
  ...layers,
  newMarkersLayer(getNextLayerName(layers)),
];

/** Remove the layer at `index`. */
export const deleteLayer = (layers: MapLayerOptions[], index: number): MapLayerOptions[] =>
  layers.filter((_, i) => i !== index);

/** Move the layer at `from` to `to`. An index out of the list gives the same list. */
export function moveLayer(layers: MapLayerOptions[], from: number, to: number): MapLayerOptions[] {
  if (from === to || from < 0 || to < 0 || from >= layers.length || to >= layers.length) {
    return layers;
  }
  const next = [...layers];
  const [layer] = next.splice(from, 1);
  next.splice(to, 0, layer);
  return next;
}

/** True when no other layer has `name`. Core `canRename` keeps the layer names unique. */
export const isLayerNameFree = (layers: MapLayerOptions[], index: number, name: string): boolean =>
  layers.every((l, i) => i === index || l.name !== name);

/** Replace the layer at `index`. */
export const replaceLayer = (layers: MapLayerOptions[], index: number, layer: MapLayerOptions): MapLayerOptions[] =>
  layers.map((l, i) => (i === index ? layer : l));

/**
 * The frames of a layer, as core `applyLayerFilter` in
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/utils/layers.ts
 * - Core applies `filterData` only when the panel has a query of that refId (`queryRefIds`). Then a query that
 *   returns no frame gives no frames.
 * - With no `filterData`, no request (no `queryRefIds`) or a query that is not in the panel, the layer gets all frames.
 */
export function getLayerFrames(
  frames: DataFrame[],
  layer: Pick<MapLayerOptions, 'filterData'>,
  queryRefIds?: string[]
): DataFrame[] {
  const { filterData } = layer;
  // The byRefId matcher of the core editor saves the refId as `options`, as core compares it.
  const refId: unknown = filterData?.options;
  if (!filterData || !queryRefIds?.some((id) => id === refId)) {
    return frames;
  }
  return frames.filter(getFrameMatchers(filterData));
}

/**
 * The frames of the location editor of a layer, as core `layerEditor`: the frames that `filterData` matches. If it
 * matches no frame, all frames.
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/editor/layerEditor.tsx
 */
export function getLayerEditorFrames(frames: DataFrame[], layer: Pick<MapLayerOptions, 'filterData'>): DataFrame[] {
  if (!layer.filterData) {
    return frames;
  }
  const matched = frames.filter(getFrameMatchers(layer.filterData));
  return matched.length ? matched : frames;
}
