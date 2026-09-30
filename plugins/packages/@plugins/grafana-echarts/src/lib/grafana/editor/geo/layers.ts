import { type NestedValueAccess, type PanelOptionsEditorBuilder, type StandardEditorContext } from '@grafana/data';
import { FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';
import { DEFAULT_MARKER_STYLE } from 'lib/grafana/geo/dimensions';
import { COUNTRIES_GAZETTEER_PATH } from 'lib/grafana/geo/gazetteer';
import { getLayerStyleConfig } from 'lib/grafana/geo/markers';
import { DEFAULT_HEATMAP_CONFIG } from 'lib/grafana/geo/heatmap';
import { DEFAULT_ROUTE_CONFIG } from 'lib/grafana/geo/route';
import {
  getLayerEditorFrames,
  HEATMAP_LAYER_TYPE,
  MARKERS_LAYER_TYPE,
  replaceLayer,
  resolveLayers,
  ROUTE_LAYER_TYPE,
} from 'lib/grafana/geo/layers';
import { type PanelOptions } from 'types';
import { GeoFrameSelectionEditor } from './GeoFrameSelectionEditor';
import { GeoLayersEditor } from './GeoLayersEditor';
import { GeoScaleDimensionEditor, type ScaleEditorSettings } from './GeoScaleDimensionEditor';
import { addLocationFields } from './location';
import { addStyleFields } from './style';

/** The group of the layers editor, as core Geomap. */
export const geoLayersCategoryName = 'Map layers';
const layersCategory = [geoLayersCategoryName];

type OptionObject = Record<string, unknown>;

const isOptionObject = (value: unknown): value is OptionObject => typeof value === 'object' && value !== null;

const isMapLayer = (value: OptionObject): value is OptionObject & MapLayerOptions =>
  typeof value.type === 'string' && typeof value.name === 'string';

/** The value at a dot path, for example `location.mode`. */
const getOption = (object: OptionObject, path: string[]): unknown =>
  path.reduce<unknown>((value, key) => (isOptionObject(value) ? value[key] : undefined), object);

/** A copy of `object` with `value` at a dot path. The objects on the path are copied, the others are shared. */
function setOption(object: OptionObject, [key, ...rest]: string[], value: unknown): OptionObject {
  const child = object[key];
  return { ...object, [key]: rest.length ? setOption(isOptionObject(child) ? child : {}, rest, value) : value };
}

/**
 * The value that core uses for an unset option: the Auto mode, the countries gazetteer (`getGazetteer`), the
 * tooltip switch on, the legend on (`defaultOptions` of the markers layer), and each value of the default style
 * (`value?.size ?? defaultStyleConfig.size`).
 */
const UNSET_LAYER_VALUES: OptionObject = {
  location: { mode: FrameGeometrySourceMode.Auto, gazetteer: COUNTRIES_GAZETTEER_PATH },
  tooltip: true,
  config: { style: DEFAULT_MARKER_STYLE, showLegend: true },
};

/** The unset values of a heatmap layer: the core `defaultOptions` of the heatmap layer. */
const UNSET_HEATMAP_VALUES: OptionObject = { ...UNSET_LAYER_VALUES, config: DEFAULT_HEATMAP_CONFIG };

/** The unset values of a route layer: the core `defaultOptions` of the route layer. */
const UNSET_ROUTE_VALUES: OptionObject = { ...UNSET_LAYER_VALUES, config: DEFAULT_ROUTE_CONFIG };

/** The unset values of each layer type that is not a markers layer. */
const UNSET_VALUES_BY_TYPE: Record<string, OptionObject> = {
  [HEATMAP_LAYER_TYPE]: UNSET_HEATMAP_VALUES,
  [ROUTE_LAYER_TYPE]: UNSET_ROUTE_VALUES,
};

/** The layer types that the panel draws, as the core layer type select. */
const LAYER_TYPES = [
  { value: MARKERS_LAYER_TYPE, label: 'Markers' },
  { value: HEATMAP_LAYER_TYPE, label: 'Heatmap' },
  { value: ROUTE_LAYER_TYPE, label: 'Route' },
];

const SYMBOL_FIXED_PATH = 'config.style.symbol.fixed';

/**
 * The value access of the layer at `index`. It reads the resolved layer list, so the default layer of an unset
 * `layers` option shows its values. A change writes the full list. The context of the layer options has the
 * layer as `options`, and the frames of its `filterData` query as `data`.
 */
function layerValues(layers: MapLayerOptions[], index: number) {
  const layer = layers[index];
  const layerObject: OptionObject = { ...layer };
  const unset = UNSET_VALUES_BY_TYPE[layer.type] ?? UNSET_LAYER_VALUES;
  return (parent: NestedValueAccess): NestedValueAccess => ({
    getValue: (path) => {
      const keys = path.split('.');
      const value = getOption(layerObject, keys);
      // Core falls back to the default symbol only when `symbol` is unset (`value?.symbol ?? defaultStyleConfig.symbol`).
      // A cleared symbol is `{ mode: 'fixed' }`, so it shows no symbol.
      if (
        value !== undefined ||
        (path === SYMBOL_FIXED_PATH && getOption(layerObject, keys.slice(0, -1)) !== undefined)
      ) {
        return value;
      }
      return getOption(unset, keys);
    },
    onChange: (path, value) => {
      // A new type gets the default config of that type, as core `layerEditor`.
      const next = setOption(path === 'type' ? { ...layerObject, config: {} } : layerObject, path.split('.'), value);
      if (isMapLayer(next)) {
        parent.onChange('layers', replaceLayer(layers, index, next));
      }
    },
    getContext: (context: StandardEditorContext<unknown>) => ({
      ...context,
      options: layer,
      data: getLayerEditorFrames(context.data, layer),
    }),
  });
}

/**
 * The options of a heatmap layer, as core `registerOptionsUI` of the heatmap layer: the weight, the radius and the
 * blur. https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/heatMap.tsx
 * https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/geomap/#heatmap-layer
 */
function addHeatmapFields(builder: PanelOptionsEditorBuilder<MapLayerOptions>): void {
  builder
    .addCustomEditor<ScaleEditorSettings, unknown>({
      id: 'config.weight',
      path: 'config.weight',
      name: 'Weight values',
      description: 'Scale the distribution for each row',
      editor: GeoScaleDimensionEditor,
      settings: { min: 0, max: 1, hideRange: true, label: 'Weight' },
    })
    .addSliderInput({
      path: 'config.radius',
      name: 'Radius',
      description: 'Configures the size of clusters',
      settings: { min: 1, max: 50, step: 1 },
    })
    .addSliderInput({
      path: 'config.blur',
      name: 'Blur',
      description: 'Configures the amount of blur of clusters',
      settings: { min: 1, max: 50, step: 1 },
    });
}

/**
 * The options of a route layer, as core `registerOptionsUI` of the route layer: the style with no rotation, and
 * the arrow. https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/layers/data/routeLayer.tsx
 * https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/geomap/#route-layer-beta
 */
function addRouteFields(builder: PanelOptionsEditorBuilder<MapLayerOptions>, layer: MapLayerOptions): void {
  addStyleFields(builder, getLayerStyleConfig(layer), false);
  builder.addRadio({
    path: 'config.arrow',
    name: 'Arrow',
    settings: {
      options: [
        { label: 'None', value: 0 },
        { label: 'Forward', value: 1 },
        { label: 'Reverse', value: -1 },
      ],
    },
  });
}

/**
 * The layers editor of core Geomap: the layer list, then the options of each markers, heatmap and route layer in a group
 * of the layer name. Core shows the options of the selected layer only. This panel has no instance state to keep the
 * selection, so it shows each layer.
 * Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/module.tsx
 * and https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/editor/layerEditor.tsx
 * Custom editors: https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors
 * `addNestedOptions` has no doc page. Its source:
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/utils/OptionsUIBuilders.ts
 */
export function addGeoLayerOptions(
  builder: PanelOptionsEditorBuilder<PanelOptions>,
  options: Partial<PanelOptions> | undefined
): void {
  builder.addCustomEditor({
    id: 'layers',
    path: 'layers',
    name: '',
    description: 'The map layers. Each markers layer draws the rows of its query as markers.',
    category: layersCategory,
    editor: GeoLayersEditor,
  });

  const layers = resolveLayers(options?.layers);
  layers.forEach((layer, index) => {
    const isMarkers = layer.type === MARKERS_LAYER_TYPE;
    if (!LAYER_TYPES.some((t) => t.value === layer.type)) {
      return;
    }
    builder.addNestedOptions<MapLayerOptions>({
      path: `layers[${index}]`,
      category: [`Layer: ${layer.name}`],
      values: layerValues(layers, index),
      build: (layerBuilder) => {
        layerBuilder.addSelect({
          path: 'type',
          name: 'Layer type',
          settings: { options: LAYER_TYPES },
        });
        layerBuilder.addCustomEditor({
          id: 'filterData',
          path: 'filterData',
          name: 'Data',
          description: 'The query of the layer. No query gives the first frame of the panel.',
          editor: GeoFrameSelectionEditor,
        });
        addLocationFields(layerBuilder, layer.location);
        if (isMarkers) {
          addStyleFields(layerBuilder, getLayerStyleConfig(layer));
          // Core adds the legend switch after the style options.
          layerBuilder.addBooleanSwitch({
            path: 'config.showLegend',
            name: 'Show legend',
            description: 'Show map legend',
            defaultValue: true,
          });
        } else if (layer.type === ROUTE_LAYER_TYPE) {
          addRouteFields(layerBuilder, layer);
        } else {
          addHeatmapFields(layerBuilder);
        }
        // Core adds this switch after the options of each layer type (`layerEditor.tsx`).
        layerBuilder.addBooleanSwitch({
          path: 'tooltip',
          name: 'Display tooltip',
          description: 'Show the tooltip for layer',
        });
      },
    });
  });
}
