import { createDataFrame, FieldType, getPanelDataSummary, VisualizationSuggestionScore } from '@grafana/data';
import { stateTimelineSuggestionsSupplier, TIMELINE_MAX_NUMBER_FIELDS } from './suggestions';

const timeFrame = (fields: Array<{ name: string; type: FieldType; values: unknown[] }>) =>
  createDataFrame({ fields: [{ name: 'time', type: FieldType.time, values: [1000, 2000, 3000] }, ...fields] });

const numbers = (count: number) =>
  Array.from({ length: count }, (_, i) => ({ name: `value-${i}`, type: FieldType.number, values: [1, 2, 3] }));

describe('stateTimelineSuggestionsSupplier', () => {
  it('suggests a state timeline for a time field and a string field', () => {
    const result = stateTimelineSuggestionsSupplier(
      getPanelDataSummary([timeFrame([{ name: 'state', type: FieldType.string, values: ['a', 'b', 'a'] }])])
    );
    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({
      name: 'State timeline',
      score: VisualizationSuggestionScore.OK,
      options: { seriesType: 'custom' },
    });
  });

  it('suggests a state timeline for a time field and a number field', () => {
    expect(stateTimelineSuggestionsSupplier(getPanelDataSummary([timeFrame(numbers(1))]))).toHaveLength(1);
  });

  it('withholds without a time field', () => {
    const frame = createDataFrame({ fields: [{ name: 'state', type: FieldType.string, values: ['a'] }] });
    expect(stateTimelineSuggestionsSupplier(getPanelDataSummary([frame]))).toBeUndefined();
  });

  it(`withholds at ${TIMELINE_MAX_NUMBER_FIELDS} number fields, which do not fit on the Y axis`, () => {
    const summary = getPanelDataSummary([timeFrame(numbers(TIMELINE_MAX_NUMBER_FIELDS))]);
    expect(stateTimelineSuggestionsSupplier(summary)).toBeUndefined();
  });

  it('withholds for logs', () => {
    const frame = timeFrame([{ name: 'line', type: FieldType.string, values: ['a', 'b', 'c'] }]);
    frame.meta = { preferredVisualisationType: 'logs' };
    expect(stateTimelineSuggestionsSupplier(getPanelDataSummary([frame]))).toBeUndefined();
  });

  it('withholds for an empty response', () => {
    expect(stateTimelineSuggestionsSupplier(getPanelDataSummary([]))).toBeUndefined();
  });
});
