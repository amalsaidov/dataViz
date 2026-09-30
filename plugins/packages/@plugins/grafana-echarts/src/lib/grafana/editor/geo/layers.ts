import { type NestedValueAccess, type PanelOptionsEditorBuilder, type StandardEditorContext } from '@grafana/data';
import { FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';
import { DEFAULT_MARKER_STYLE } from 'lib/grafana/geo/dimensions';
import { COUNTRIES_GAZETTEER_PATH } from 'lib/grafana/geo/gazetteer';
import { getLayerStyleConfig } from 'lib/grafana/geo/markers';
import { getLayerEditorFrames, MARKERS_LAYER_TYPE, replaceLayer, resolveLayers } from 'lib/grafana/geo/layers';
import { type PanelOptions } from 'types';
import { GeoFrameSelectionEditor } from './GeoFrameSelectionEditor';
import { GeoLayersEditor } from './GeoLayersEditor';
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

const SYMBOL_FIXED_PATH = 'config.style.symbol.fixed';

/**
 * The value access of the layer at `index`. It reads the resolved layer list, so the default layer of an unset
 * `layers` option shows its values. A change writes the full list. The context of the layer options has the
 * layer as `options`, and the frames of its `filterData` query as `data`.
 */
function layerValues(layers: MapLayerOptions[], index: number) {
  const layer = layers[index];
  const layerObject: OptionObject = { ...layer };
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
      return getOption(UNSET_LAYER_VALUES, keys);
    },
    onChange: (path, value) => {
      const next = setOption(layerObject, path.split('.'), value);
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
 * The layers editor of core Geomap: the layer list, then the options of each markers layer in a group of the
 * layer name. Core shows the options of the selected layer only. This panel has no instance state to keep the
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
    category: layersCategory,
    editor: GeoLayersEditor,
  });

  const layers = resolveLayers(options?.layers);
  layers.forEach((layer, index) => {
    if (layer.type !== MARKERS_LAYER_TYPE) {
      return;
    }
    builder.addNestedOptions<MapLayerOptions>({
      path: `layers[${index}]`,
      category: [`Layer: ${layer.name}`],
      values: layerValues(layers, index),
      build: (layerBuilder) => {
        layerBuilder.addCustomEditor({
          id: 'filterData',
          path: 'filterData',
          name: 'Data',
          description: 'The query of the layer. No query gives the first frame of the panel.',
          editor: GeoFrameSelectionEditor,
        });
        addLocationFields(layerBuilder, layer.location);
        addStyleFields(layerBuilder, getLayerStyleConfig(layer));
        // Core adds the legend switch after the style options.
        layerBuilder.addBooleanSwitch({
          path: 'config.showLegend',
          name: 'Show legend',
          description: 'Show map legend',
          defaultValue: true,
        });
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
