import { createDataFrame, FieldType } from '@grafana/data';
import { FrameGeometrySourceMode } from '@grafana/schema';
import { getFramePositions, getLocationFields, getLocationMatchers } from './location';

const frame = (fields: Array<{ name: string; type: FieldType; values: unknown[] }>) => createDataFrame({ fields });
const numbers = (name: string, values: Array<number | null>) => ({ name, type: FieldType.number, values });
const strings = (name: string, values: string[]) => ({ name, type: FieldType.string, values });

describe('getLocationFields (Auto)', () => {
  it.each([
    ['lat', 'lon'],
    ['Latitude', 'Longitude'],
    ['latitude', 'lng'],
  ])('finds coords by %s and %s', (lat, lon) => {
    const fields = getLocationFields(frame([numbers(lat, [1]), numbers(lon, [2])]), getLocationMatchers());
    expect(fields.mode).toBe(FrameGeometrySourceMode.Coords);
    expect(fields.latitude?.name).toBe(lat);
    expect(fields.longitude?.name).toBe(lon);
  });

  it('prefers coords over geohash and lookup', () => {
    const f = frame([
      numbers('lat', [1]),
      numbers('lon', [2]),
      strings('geohash', ['u4pr']),
      strings('lookup', ['AD']),
    ]);
    expect(getLocationFields(f, getLocationMatchers()).mode).toBe(FrameGeometrySourceMode.Coords);
  });

  it('does not use coords with only one of lat and lon', () => {
    const f = frame([numbers('lat', [1]), strings('geohash', ['u4pr'])]);
    expect(getLocationFields(f, getLocationMatchers()).mode).toBe(FrameGeometrySourceMode.Geohash);
  });

  it('falls through geohash to lookup', () => {
    const f = frame([strings('lookup', ['AD'])]);
    expect(getLocationFields(f, getLocationMatchers()).mode).toBe(FrameGeometrySourceMode.Lookup);
  });

  it('keeps the Auto mode when nothing matches', () => {
    const f = frame([numbers('value', [1])]);
    expect(getLocationFields(f, getLocationMatchers()).mode).toBe(FrameGeometrySourceMode.Auto);
  });
});

describe('getFramePositions', () => {
  it('warns in Auto mode when nothing matches', () => {
    expect(getFramePositions(frame([numbers('value', [1])]), getLocationMatchers()).warning).toBe(
      'Unable to find location fields'
    );
  });

  it('reads coords, and leaves a null or non-finite row empty', () => {
    const f = frame([numbers('lat', [10, null, 30, NaN]), numbers('lon', [1, 2, null, 4])]);
    const result = getFramePositions(f, getLocationMatchers());
    expect(result.positions).toEqual([[1, 10], undefined, undefined, undefined]);
    expect(result.description).toBe('coords: lat, lon');
  });

  it('reads numeric strings as coordinates, and leaves other strings empty', () => {
    const f = frame([strings('lat', ['42.5', 'x', '']), strings('lon', ['1.5', '2', '3'])]);
    expect(getFramePositions(f, getLocationMatchers()).positions).toEqual([[1.5, 42.5], undefined, undefined]);
  });

  it('uses the named fields in Coords mode, and warns when none is named', () => {
    const f = frame([numbers('lat', [10]), numbers('lon', [1]), numbers('y', [20]), numbers('x', [2])]);
    const named = getLocationMatchers({ mode: FrameGeometrySourceMode.Coords, latitude: 'y', longitude: 'x' });
    expect(getFramePositions(f, named).positions).toEqual([[2, 20]]);
    const unnamed = getLocationMatchers({ mode: FrameGeometrySourceMode.Coords });
    expect(getFramePositions(f, unnamed).warning).toBe('Select latitude/longitude fields');
  });

  it('decodes geohash, and leaves an empty hash empty', () => {
    const result = getFramePositions(frame([strings('geohash', ['ezs42', ''])]), getLocationMatchers());
    expect(result.positions?.[0]?.[1]).toBeCloseTo(42.60498046875, 10);
    expect(result.positions?.[1]).toBeUndefined();
  });

  it('warns in Geohash mode when no field is named', () => {
    const src = { mode: FrameGeometrySourceMode.Geohash };
    expect(getFramePositions(frame([strings('geohash', ['ezs42'])]), getLocationMatchers(src)).warning).toBe(
      'Select geohash field'
    );
    expect(
      getFramePositions(frame([strings('h', ['ezs42'])]), getLocationMatchers({ ...src, geohash: 'h' })).positions
    ).toHaveLength(1);
  });

  it('looks up places in the default gazetteer, and leaves an unknown place empty', () => {
    const f = frame([strings('lookup', ['AD', 'Nowhere'])]);
    const result = getFramePositions(f, getLocationMatchers());
    expect(result.positions).toEqual([[1.601554, 42.546245], undefined]);
    expect(result.description).toBe('lookup: public/gazetteer/countries.json');
  });

  it('looks up in the named gazetteer, and uses the first string field without a name', () => {
    const f = frame([numbers('n', [1]), strings('state', ['AK'])]);
    const src = { mode: FrameGeometrySourceMode.Lookup, gazetteer: 'public/gazetteer/usa-states.json' };
    expect(getFramePositions(f, getLocationMatchers(src)).positions).toEqual([[-152.2683, 61.385]]);
  });

  it('warns for a gazetteer that is not bundled', () => {
    const src = { mode: FrameGeometrySourceMode.Lookup, gazetteer: 'https://example.com/x.json' };
    expect(getFramePositions(frame([strings('lookup', ['AD'])]), getLocationMatchers(src)).warning).toBe(
      'Gazetteer not found'
    );
  });

  it('warns in Lookup mode when there is no string field', () => {
    const src = { mode: FrameGeometrySourceMode.Lookup };
    expect(getFramePositions(frame([numbers('n', [1])]), getLocationMatchers(src)).warning).toBe('Select lookup field');
  });
});
