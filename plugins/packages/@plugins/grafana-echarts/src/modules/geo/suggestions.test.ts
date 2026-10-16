import { createDataFrame, FieldType, getPanelDataSummary, VisualizationSuggestionScore } from '@grafana/data';
import { geoSuggestionsSupplier } from './suggestions';

const summary = (fields: Array<{ name: string; type: FieldType; values: unknown[] }>) =>
  getPanelDataSummary([createDataFrame({ fields })]);

describe('geoSuggestionsSupplier', () => {
  it('returns void when no field gives a position', () => {
    expect(
      geoSuggestionsSupplier(summary([{ name: 'value', type: FieldType.number, values: [1, 2] }]))
    ).toBeUndefined();
  });

  it('returns void for lat/lon fields with no rows', () => {
    const empty = summary([
      { name: 'lat', type: FieldType.number, values: [] },
      { name: 'lon', type: FieldType.number, values: [] },
    ]);
    expect(empty.hasData).toBe(false);
    expect(geoSuggestionsSupplier(empty)).toBeUndefined();
  });

  it('returns void when there is no data', () => {
    expect(geoSuggestionsSupplier(getPanelDataSummary([]))).toBeUndefined();
  });

  it.each([
    [
      'lat/lon',
      [
        { name: 'lat', type: FieldType.number, values: [1] },
        { name: 'lon', type: FieldType.number, values: [2] },
      ],
    ],
    ['geohash', [{ name: 'geohash', type: FieldType.string, values: ['ezs42'] }]],
    ['lookup', [{ name: 'lookup', type: FieldType.string, values: ['AD'] }]],
  ])('suggests one Best card for %s', (_name, fields) => {
    const result = geoSuggestionsSupplier(summary(fields))!;
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ score: VisualizationSuggestionScore.Best, options: { seriesType: 'map' } });
  });
});
