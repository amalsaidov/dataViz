import { createDataFrame, FrameMatcherID } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import {
  addMarkersLayer,
  deleteLayer,
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
    expect(getLayerFrames([a, b], { filterData: filterData('B') })).toEqual([b]);
    // No frame of that query: all frames, see `getLayerFrames`.
    expect(getLayerFrames([a, b], { filterData: filterData('C') })).toEqual([a, b]);
  });
});
