import { createDataFrame, FrameMatcherID } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import {
  addMarkersLayer,
  deleteLayer,
  getLayerEditorFrames,
  getLayerFrames,
  getNextLayerName,
  isLayerNameFree,
  moveLayer,
  replaceLayer,
  resolveLayers,
} from './layers';

const layer = (name: string): MapLayerOptions => ({ type: 'markers', name });
const names = (layers: MapLayerOptions[]) => layers.map((l) => l.name);

describe('geo layers', () => {
  it('gives one Auto markers layer for an unset option, as core', () => {
    expect(resolveLayers(undefined)).toEqual([
      { type: 'markers', name: 'Layer 1', config: {}, location: { mode: 'auto' }, tooltip: true },
    ]);
    expect(resolveLayers([])).toEqual([]);
  });

  // The option defaults of the layer editors can write a layer with no name and no type (#864).
  it('gives the default markers values to a layer with no name and no type', () => {
    const partial = [layer('a'), { config: { showLegend: true } }] as unknown as MapLayerOptions[];
    expect(resolveLayers(partial)).toEqual([
      layer('a'),
      { type: 'markers', name: 'Layer 2', config: { showLegend: true }, location: { mode: 'auto' }, tooltip: true },
    ]);
  });

  it('names a new layer with the next free number, as core getNextLayerName', () => {
    expect(getNextLayerName([])).toBe('Layer 1');
    expect(getNextLayerName([layer('Layer 1')])).toBe('Layer 2');
    expect(getNextLayerName([layer('Layer 2')])).toBe('Layer 3');
    expect(names(addMarkersLayer([layer('a'), layer('Layer 3')]))).toEqual(['a', 'Layer 3', 'Layer 4']);
  });

  it('deletes, moves and replaces a layer', () => {
    const layers = [layer('a'), layer('b'), layer('c')];
    expect(names(deleteLayer(layers, 1))).toEqual(['a', 'c']);
    expect(names(moveLayer(layers, 0, 2))).toEqual(['b', 'c', 'a']);
    expect(names(moveLayer(layers, 2, 1))).toEqual(['a', 'c', 'b']);
    expect(moveLayer(layers, 0, 3)).toBe(layers);
    expect(names(replaceLayer(layers, 1, layer('x')))).toEqual(['a', 'x', 'c']);
  });

  it('keeps the layer names unique', () => {
    const layers = [layer('a'), layer('b')];
    expect(isLayerNameFree(layers, 0, 'b')).toBe(false);
    expect(isLayerNameFree(layers, 0, 'a')).toBe(true);
    expect(isLayerNameFree(layers, 0, 'c')).toBe(true);
  });

  it('filters the frames of a layer by its filterData query', () => {
    const a = createDataFrame({ refId: 'A', fields: [] });
    const b = createDataFrame({ refId: 'B', fields: [] });
    const filterData = (refId: string) => ({ id: FrameMatcherID.byRefId, options: refId });
    expect(getLayerFrames([a, b], {})).toEqual([a, b]);
    expect(getLayerFrames([a, b], { filterData: filterData('B') }, ['A', 'B'])).toEqual([b]);
  });

  it('gives no frames for a panel query that returns no frame, as core applyLayerFilter', () => {
    const a = createDataFrame({ refId: 'A', fields: [] });
    const filterData = { id: FrameMatcherID.byRefId, options: 'C' };
    expect(getLayerFrames([a], { filterData }, ['A', 'C'])).toEqual([]);
  });

  it('ignores the filter with no request, as core applyLayerFilter', () => {
    const a = createDataFrame({ refId: 'A', fields: [] });
    const b = createDataFrame({ refId: 'B', fields: [] });
    expect(getLayerFrames([a, b], { filterData: { id: FrameMatcherID.byRefId, options: 'B' } })).toEqual([a, b]);
  });

  it('gives the location editor the matched frames, else all frames, as core layerEditor', () => {
    const a = createDataFrame({ refId: 'A', fields: [] });
    const b = createDataFrame({ refId: 'B', fields: [] });
    const filterData = (refId: string) => ({ id: FrameMatcherID.byRefId, options: refId });
    expect(getLayerEditorFrames([a, b], {})).toEqual([a, b]);
    expect(getLayerEditorFrames([a, b], { filterData: filterData('B') })).toEqual([b]);
    expect(getLayerEditorFrames([a, b], { filterData: filterData('C') })).toEqual([a, b]);
  });

  it('ignores the filter of a query that is not in the panel, as core applyLayerFilter', () => {
    const a = createDataFrame({ refId: 'A', fields: [] });
    const filterData = { id: FrameMatcherID.byRefId, options: 'C' };
    expect(getLayerFrames([a], { filterData }, ['A'])).toEqual([a]);
  });
});
