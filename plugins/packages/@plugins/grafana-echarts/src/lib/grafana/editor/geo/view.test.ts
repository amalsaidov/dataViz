import { PanelOptionsEditorBuilder } from '@grafana/data';
import { MAP_VIEW_PRESETS } from 'lib/grafana/geo/view';
import { type PanelOptions } from 'types';
import {
  applyCurrentMapView,
  DEFAULT_MAP_VIEW,
  getMapViewFields,
  MAP_VIEW_OPTIONS,
  resolveMapView,
  selectMapViewPreset,
} from './mapView';
import { addGeoViewOptions, geoViewCategoryName } from './view';

describe('addGeoViewOptions', () => {
  it('adds one "Map view" editor of the full view, with the core default', () => {
    const items = addGeoViewOptions(new PanelOptionsEditorBuilder<PanelOptions>()).getItems();
    expect(items.map((i) => [i.path, i.category, i.defaultValue])).toEqual([
      ['view', [geoViewCategoryName], { id: 'zero', lat: 0, lon: 0, zoom: 1 }],
    ]);
  });
});

describe('MAP_VIEW_OPTIONS', () => {
  it('lists the presets in core order', () => {
    expect(MAP_VIEW_OPTIONS.map((o) => o.value)).toEqual(MAP_VIEW_PRESETS.map((p) => p.id));
    expect(MAP_VIEW_OPTIONS.slice(0, 3).map((o) => o.label)).toEqual(['Fit to data', '(0°, 0°)', 'Coordinates']);
  });
});

describe('getMapViewFields', () => {
  it.each([
    ['coords', { coords: true, padding: false }],
    ['fit', { coords: false, padding: true }],
    ['zero', { coords: false, padding: false }],
    ['europe', { coords: false, padding: false }],
  ])('shows the inputs of %s', (id, expected) => {
    expect(getMapViewFields({ id })).toEqual(expected);
  });

  it('uses the default view when the option is unset', () => {
    expect(resolveMapView(undefined)).toEqual(DEFAULT_MAP_VIEW);
  });
});

describe('selectMapViewPreset', () => {
  const saved = { id: 'coords', lat: 10, lon: 20, zoom: 7, minZoom: 2 };

  it('copies the preset center and zoom, as core', () => {
    expect(selectMapViewPreset(saved, 'europe')).toEqual({ id: 'europe', lat: 46, lon: 14, zoom: 4, minZoom: 2 });
    expect(selectMapViewPreset(saved, 'fit')).toEqual({ ...saved, id: 'fit', zoom: 15 });
  });

  it('keeps the saved values for a preset without them', () => {
    expect(selectMapViewPreset({ ...saved, id: 'europe' }, 'coords')).toEqual(saved);
  });

  it('ignores an unknown id', () => {
    expect(selectMapViewPreset(saved, 'mars')).toBe(saved);
  });
});

describe('applyCurrentMapView', () => {
  const saved = { id: 'europe', lat: 46, lon: 14, zoom: 4, minZoom: 2 };

  it('saves the live view as a Coordinates view, as core', () => {
    const state = { readMapView: () => ({ lon: 1.5, lat: 2.5, zoom: 6.25 }) };
    expect(applyCurrentMapView(saved, state)).toEqual({ id: 'coords', lat: 2.5, lon: 1.5, zoom: 6.25, minZoom: 2 });
  });

  it('keeps the saved view without a live view', () => {
    expect(applyCurrentMapView(saved, undefined)).toBe(saved);
    expect(applyCurrentMapView(saved, { readMapView: () => undefined })).toBe(saved);
  });
});
