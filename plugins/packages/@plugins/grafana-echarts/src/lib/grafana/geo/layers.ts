// The data layer list of core Geomap (`layers`): the default list and the edits of the core layers editor.
// Core: `initMapAsync` in https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/GeomapPanel.tsx,
// `getNextLayerName` in https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/utils/utils.ts
// and `defaultMarkersConfig` in
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/markersLayer.tsx
import { type DataFrame, getFrameMatchers } from '@grafana/data';
import { FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';

/** The layer type of the core markers layer (`MARKERS_LAYER_ID`). */
export const MARKERS_LAYER_TYPE = 'markers';

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
 * The frames of a layer. A `filterData` matcher keeps the frames that it matches, as core `applyLayerFilter`.
 * With no `filterData`, the layer gets all frames.
 * Core applies the filter only when the panel has a query of that refId. The chart context has no queries, so a
 * filter that matches no frame gives all frames. Thus a query that returns no frame gives all frames, not none.
 */
export function getLayerFrames(frames: DataFrame[], layer: Pick<MapLayerOptions, 'filterData'>): DataFrame[] {
  if (!layer.filterData) {
    return frames;
  }
  const matched = frames.filter(getFrameMatchers(layer.filterData));
  return matched.length ? matched : frames;
}
