import {
  createDataFrame,
  isNestedPanelOptions,
  type NestedValueAccess,
  PanelOptionsEditorBuilder,
  standardEditorsRegistry,
  type StandardEditorContext,
} from '@grafana/data';
import { FrameGeometrySourceMode, type MapLayerOptions } from '@grafana/schema';
import { type PanelOptions } from 'types';
import { addGeoLayerOptions } from './layers';

const noEditor = (): null => null;
standardEditorsRegistry.setInit(() =>
  ['select', 'field-name', 'radio', 'slider', 'number', 'boolean', 'color'].map((id) => ({
    id,
    name: id,
    editor: noEditor,
  }))
);

/** Build the options for `options`, as the panel editor does. */
function build(options: Partial<PanelOptions>) {
  const builder = new PanelOptionsEditorBuilder<PanelOptions>();
  addGeoLayerOptions(builder, options);
  return builder.getItems();
}

/** The nested options of one layer: the paths of its items, and its value access over `options`. */
function layerItems(options: Partial<PanelOptions>, index: number, data = [createDataFrame({ fields: [] })]) {
  const nested = build(options).filter(isNestedPanelOptions)[index];
  const onChange = jest.fn();
  const parent: NestedValueAccess = { getValue: () => undefined, onChange };
  const access = nested.getNestedValueAccess(parent);
  const context = access.getContext!({ data, options } as StandardEditorContext<unknown>);
  const builder = new PanelOptionsEditorBuilder<MapLayerOptions>();
  nested.getBuilder()(builder, context as StandardEditorContext<MapLayerOptions>);
  return { nested, access, context, onChange, paths: builder.getItems().map((i) => i.path) };
}

// The style items of core `StyleEditor`, then the core tooltip switch.
const STYLE_PATHS = [
  'config.style.size',
  'config.style.symbol.fixed',
  'config.style.symbolAlign.vertical',
  'config.style.symbolAlign.horizontal',
  'config.style.color',
  'config.style.opacity',
  'config.style.rotation',
  'config.style.text',
];
const TOOLTIP = ['tooltip'];

const markers = (name: string, extra: Partial<MapLayerOptions> = {}): MapLayerOptions => ({
  type: 'markers',
  name,
  ...extra,
});

describe('geo layer options', () => {
  it('adds the layer list, and one group of options for each markers and heatmap layer', () => {
    const items = build({ layers: [markers('a'), { type: 'heatmap', name: 'h' }, { type: 'xyz', name: 'x' }] });
    expect(items[0]).toMatchObject({ id: 'layers', path: 'layers', category: ['Map layers'] });
    expect(items.filter(isNestedPanelOptions).map((i) => i.category)).toEqual([['Layer: a'], ['Layer: h']]);
  });

  it('gives a heatmap layer the core heatmap options and defaults', () => {
    const { access, paths } = layerItems({ layers: [{ type: 'heatmap', name: 'h' }] }, 0);
    expect(paths).toEqual([
      'type',
      'filterData',
      'location.mode',
      'config.weight',
      'config.radius',
      'config.blur',
      ...TOOLTIP,
    ]);
    expect(access.getValue('config.weight')).toEqual({ fixed: 1, min: 0, max: 1 });
    expect([access.getValue('config.radius'), access.getValue('config.blur')]).toEqual([5, 15]);
  });

  it('gives a GeoJSON layer the core GeoJSON options and defaults, with no data or location options', () => {
    const { access, paths } = layerItems({ layers: [{ type: 'geojson', name: 'g' }] }, 0);
    expect(paths).toEqual([
      'type',
      'config.src',
      'config.style.color.fixed',
      'config.style.opacity',
      'config.rules',
      ...TOOLTIP,
    ]);
    expect(access.getValue('config.src')).toBe('public/maps/countries.geojson');
    expect([access.getValue('config.style.color.fixed'), access.getValue('config.style.opacity')]).toEqual([
      'dark-green',
      0.4,
    ]);
    expect(access.getValue('config.rules')).toEqual([]);
  });

  it('gives a route layer the core style with no rotation, the arrow and the core defaults', () => {
    const { access, paths } = layerItems({ layers: [{ type: 'route', name: 'r' }] }, 0);
    expect(paths).toEqual([
      'type',
      'filterData',
      'location.mode',
      ...STYLE_PATHS.filter((p) => p !== 'config.style.rotation'),
      'config.arrow',
      ...TOOLTIP,
    ]);
    expect(access.getValue('config.arrow')).toBe(0);
    expect([access.getValue('config.style.opacity'), access.getValue('config.style.lineWidth')]).toEqual([1, 2]);
    expect(access.getValue('config.style.size')).toEqual({ fixed: 5, min: 2, max: 15 });
  });

  it('clears the config when the layer type changes, as core', () => {
    const layer = markers('a', { config: { style: { size: { fixed: 9 } } }, tooltip: false });
    const { access, onChange } = layerItems({ layers: [layer] }, 0);
    access.onChange('type', 'heatmap');
    expect(onChange).toHaveBeenCalledWith('layers', [{ ...layer, type: 'heatmap', config: {} }]);
  });

  it('gives the default layer options for an unset layers option', () => {
    const { nested, access, paths } = layerItems({}, 0);
    expect(nested.category).toEqual(['Layer: Layer 1']);
    expect(access.getValue('location.mode')).toBe('auto');
    expect(paths).toEqual(['type', 'filterData', 'location.mode', ...STYLE_PATHS, 'config.showLegend', ...TOOLTIP]);
  });

  it('writes a change of the default layer as the full layer list', () => {
    const { access, onChange } = layerItems({}, 0);
    access.onChange('location.mode', 'coords');
    expect(onChange).toHaveBeenCalledWith('layers', [
      {
        type: 'markers',
        name: 'Layer 1',
        config: {},
        location: { mode: FrameGeometrySourceMode.Coords },
        tooltip: true,
      },
    ]);
  });

  it('changes only the layer of the group', () => {
    const layers = [markers('a', { location: { mode: FrameGeometrySourceMode.Auto } }), markers('b')];
    const { access, onChange } = layerItems({ layers }, 1);
    access.onChange('filterData', { id: 'byRefId', options: 'B' });
    expect(onChange).toHaveBeenCalledWith('layers', [
      layers[0],
      markers('b', { filterData: { id: 'byRefId', options: 'B' } }),
    ]);
    // The saved list is not changed in place.
    expect(layers[1].filterData).toBeUndefined();
  });

  it('shows the fields of each location mode, as core addLocationFields', () => {
    const paths = (location: MapLayerOptions['location']) =>
      layerItems({ layers: [markers('a', { location })] }, 0).paths;
    expect(paths({ mode: FrameGeometrySourceMode.Coords })).toEqual([
      'type',
      'filterData',
      'location.mode',
      'location.latitude',
      'location.longitude',
      ...STYLE_PATHS,
      'config.showLegend',
      ...TOOLTIP,
    ]);
    expect(paths({ mode: FrameGeometrySourceMode.Geohash })).toEqual([
      'type',
      'filterData',
      'location.mode',
      'location.geohash',
      ...STYLE_PATHS,
      'config.showLegend',
      ...TOOLTIP,
    ]);
    expect(paths({ mode: FrameGeometrySourceMode.Lookup })).toEqual([
      'type',
      'filterData',
      'location.mode',
      'location.lookup',
      'location.gazetteer',
      ...STYLE_PATHS,
      'config.showLegend',
      ...TOOLTIP,
    ]);
  });

  it('shows the legend switch on for a layer with no showLegend, as core', () => {
    const { access } = layerItems({ layers: [markers('a')] }, 0);

    expect(access.getValue('config.showLegend')).toBe(true);
  });

  it('shows the Auto mode for a layer with no location, as core', () => {
    expect(layerItems({ layers: [markers('a')] }, 0).access.getValue('location.mode')).toBe('auto');
  });

  it('shows the countries gazetteer for an unset gazetteer, as core', () => {
    const { access } = layerItems(
      { layers: [markers('a', { location: { mode: FrameGeometrySourceMode.Lookup } })] },
      0
    );
    expect(access.getValue('location.gazetteer')).toBe('public/gazetteer/countries.json');
  });

  it('gives the field pickers the frames of the layer query', () => {
    const a = createDataFrame({ refId: 'A', fields: [] });
    const b = createDataFrame({ refId: 'B', fields: [] });
    const layers = [markers('a', { filterData: { id: 'byRefId', options: 'B' } })];
    const { context } = layerItems({ layers }, 0, [a, b]);
    expect(context.data).toEqual([b]);
    expect(context.options).toEqual(layers[0]);
  });

  it('shows the text options only for a style with a text, as core StyleEditor', () => {
    const paths = (style: object) =>
      layerItems({ layers: [markers('a', { config: { style } })] }, 0).paths.filter((p) => p.includes('textConfig'));
    expect(paths({})).toEqual([]);
    expect(paths({ text: { mode: 'fixed', fixed: '' } })).toEqual([]);
    expect(paths({ text: { mode: 'fixed', fixed: 'A' } })).toEqual([
      'config.style.textConfig.fontSize',
      'config.style.textConfig.offsetX',
      'config.style.textConfig.offsetY',
      'config.style.textConfig.textAlign',
      'config.style.textConfig.textBaseline',
    ]);
    expect(paths({ text: { mode: 'field', field: 'name' } })).toHaveLength(5);
  });

  it('shows each value of the default style for an unset style, as core StyleEditor', () => {
    const { access } = layerItems({ layers: [markers('a', { config: { style: { opacity: 0.9 } } })] }, 0);
    expect(access.getValue('config.style.opacity')).toBe(0.9);
    expect(access.getValue('config.style.size')).toEqual({ fixed: 5, min: 2, max: 15 });
    expect(access.getValue('config.style.color')).toEqual({ fixed: 'dark-green' });
    expect(access.getValue('config.style.symbol.fixed')).toBe('img/icons/marker/circle.svg');
    expect(access.getValue('config.style.symbolAlign.vertical')).toBe('center');
    expect(access.getValue('config.style.textConfig.fontSize')).toBe(12);
    expect(access.getValue('config.style.text')).toBeUndefined();
    expect(access.getValue('tooltip')).toBe(true);
  });

  it('writes one style value and keeps the other values of the style, as core StyleEditor', () => {
    const layers = [markers('a', { config: { showLegend: true, style: { opacity: 0.9 } } })];
    const { access, onChange } = layerItems({ layers }, 0);
    access.onChange('config.style.symbolAlign.vertical', 'top');
    expect(onChange).toHaveBeenCalledWith('layers', [
      markers('a', { config: { showLegend: true, style: { opacity: 0.9, symbolAlign: { vertical: 'top' } } } }),
    ]);
  });

  it('writes a style value of the default layer, with no other style value', () => {
    const { access, onChange } = layerItems({}, 0);
    access.onChange('config.style.size', { fixed: 9, min: 2, max: 15 });
    expect(onChange.mock.calls[0][1][0].config).toEqual({ style: { size: { fixed: 9, min: 2, max: 15 } } });
  });

  it('shows no symbol for a cleared symbol, as core draws the text only', () => {
    const style = { symbol: { mode: 'fixed' }, text: { mode: 'fixed', fixed: 'A' } };
    const { access, onChange } = layerItems({ layers: [markers('a', { config: { style } })] }, 0);
    expect(access.getValue('config.style.symbol.fixed')).toBeUndefined();
    // The default layer with no symbol shows the default circle.
    expect(layerItems({}, 0).access.getValue('config.style.symbol.fixed')).toBe('img/icons/marker/circle.svg');
    access.onChange('config.style.symbol.fixed', undefined);
    expect(onChange.mock.calls[0][1][0].config.style.symbol).toEqual({ mode: 'fixed', fixed: undefined });
  });
});
