import { type NestedValueAccess, type PanelOptionsEditorBuilder, type StandardEditorContext } from '@grafana/data';
import { FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';
import { COUNTRIES_GAZETTEER_PATH } from 'lib/grafana/geo/gazetteer';
import { getLayerEditorFrames, MARKERS_LAYER_TYPE, replaceLayer, resolveLayers } from 'lib/grafana/geo/layers';
import { type PanelOptions } from 'types';
import { GeoFrameSelectionEditor } from './GeoFrameSelectionEditor';
import { GeoLayersEditor } from './GeoLayersEditor';
import { addLocationFields } from './location';

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

/** The value that core uses for an unset option: the Auto mode, and the countries gazetteer (`getGazetteer`). */
const UNSET_LAYER_VALUES: Record<string, unknown> = {
  'location.mode': FrameGeometrySourceMode.Auto,
  'location.gazetteer': COUNTRIES_GAZETTEER_PATH,
};

/**
 * The value access of the layer at `index`. It reads the resolved layer list, so the default layer of an unset
 * `layers` option shows its values. A change writes the full list. The context of the layer options has the
 * layer as `options`, and the frames of its `filterData` query as `data`.
 */
function layerValues(layers: MapLayerOptions[], index: number) {
  const layer = layers[index];
  const layerObject: OptionObject = { ...layer };
  return (parent: NestedValueAccess): NestedValueAccess => ({
    getValue: (path) => getOption(layerObject, path.split('.')) ?? UNSET_LAYER_VALUES[path],
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
      },
    });
  });
}
