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
standardEditorsRegistry.setInit(() => ['select', 'field-name'].map((id) => ({ id, name: id, editor: noEditor })));

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

const markers = (name: string, extra: Partial<MapLayerOptions> = {}): MapLayerOptions => ({
  type: 'markers',
  name,
  ...extra,
});

describe('geo layer options', () => {
  it('adds the layer list, and one group of options for each markers layer', () => {
    const items = build({ layers: [markers('a'), { type: 'heatmap', name: 'h' }, markers('b')] });
    expect(items[0]).toMatchObject({ id: 'layers', path: 'layers', category: ['Map layers'] });
    expect(items.filter(isNestedPanelOptions).map((i) => i.category)).toEqual([['Layer: a'], ['Layer: b']]);
  });

  it('gives the default layer options for an unset layers option', () => {
    const { nested, access, paths } = layerItems({}, 0);
    expect(nested.category).toEqual(['Layer: Layer 1']);
    expect(access.getValue('location.mode')).toBe('auto');
    expect(paths).toEqual(['filterData', 'location.mode']);
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
      'filterData',
      'location.mode',
      'location.latitude',
      'location.longitude',
    ]);
    expect(paths({ mode: FrameGeometrySourceMode.Geohash })).toEqual([
      'filterData',
      'location.mode',
      'location.geohash',
    ]);
    expect(paths({ mode: FrameGeometrySourceMode.Lookup })).toEqual([
      'filterData',
      'location.mode',
      'location.lookup',
      'location.gazetteer',
    ]);
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
});
