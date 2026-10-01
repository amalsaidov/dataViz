import { FieldType, toDataFrame } from '@grafana/data';
import { type MapLayerOptions } from '@grafana/schema';
import { getGeoDataIssue } from './dataIssue';

// The geo data issue for each frame shape that has no location field (#864).

const issue = { reason: 'location-field-missing', message: 'Unable to find location fields' };

const stringOnly = toDataFrame({ fields: [{ name: 'city', type: FieldType.string, values: ['a', 'b'] }] });
const numberOnly = toDataFrame({ fields: [{ name: 'value', type: FieldType.number, values: [1, 2] }] });
const timeSeries = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [1, 2] },
    { name: 'value', type: FieldType.number, values: [1, 2] },
  ],
});
// A data source can give a field with no name.
const noNames = toDataFrame({
  fields: [{ name: undefined as unknown as string, type: FieldType.number, values: [1, 2] }],
});
const coords = toDataFrame({
  fields: [
    { name: 'lat', type: FieldType.number, values: [1, 2] },
    { name: 'lon', type: FieldType.number, values: [3, 4] },
  ],
});

describe('getGeoDataIssue', () => {
  it.each([
    ['string only', stringOnly],
    ['number only', numberOnly],
    ['time series', timeSeries],
    ['no field names', noNames],
  ])('gives the issue for a frame with no location field: %s', (_, frame) => {
    expect(getGeoDataIssue([frame], undefined)).toEqual(issue);
  });

  it('gives no issue for a frame with location fields', () => {
    expect(getGeoDataIssue([coords], undefined)).toBeUndefined();
  });

  it('gives no issue when one frame of the layer has location fields', () => {
    expect(getGeoDataIssue([stringOnly, coords], undefined)).toBeUndefined();
  });

  it('gives no issue for frames with no rows', () => {
    expect(getGeoDataIssue([toDataFrame({ fields: [] })], undefined)).toBeUndefined();
  });

  it('gives no issue for a panel with only GeoJSON layers', () => {
    const layers: MapLayerOptions[] = [{ type: 'geojson', name: 'Layer 1' }];
    expect(getGeoDataIssue([stringOnly], layers)).toBeUndefined();
  });

  it('gives the issue for a layer with no name and no type', () => {
    const layers = [{ config: { showLegend: true } }] as unknown as MapLayerOptions[];
    expect(getGeoDataIssue([stringOnly], layers)).toEqual(issue);
  });
});
