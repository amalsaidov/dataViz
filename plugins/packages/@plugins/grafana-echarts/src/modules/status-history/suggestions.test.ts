import { createDataFrame, FieldType, getPanelDataSummary, VisualizationSuggestionScore } from '@grafana/data';
import { STATUS_HISTORY_MAX_ROWS } from 'lib/echarts/charts/suggestionLimits';
import { type PanelOptions } from 'types';
import { STATUS_HISTORY_PREVIEW_COL_WIDTH, statusHistorySuggestionsSupplier } from './suggestions';

const stateFrame = (rows: number) =>
  createDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: Array.from({ length: rows }, (_, i) => i * 1000) },
      { name: 'state', type: FieldType.string, values: Array.from({ length: rows }, (_, i) => `s${i % 3}`) },
    ],
  });

describe('statusHistorySuggestionsSupplier', () => {
  it('suggests a status history for a time field and a string field', () => {
    const result = statusHistorySuggestionsSupplier(getPanelDataSummary([stateFrame(3)]));
    expect(result).toHaveLength(1);
    expect(result![0]).toMatchObject({
      name: 'Status history',
      score: VisualizationSuggestionScore.OK,
      options: { seriesType: 'custom' },
    });
  });

  it(`withholds above ${STATUS_HISTORY_MAX_ROWS} rows, one cell each`, () => {
    expect(statusHistorySuggestionsSupplier(getPanelDataSummary([stateFrame(STATUS_HISTORY_MAX_ROWS)]))).toHaveLength(
      1
    );
    expect(
      statusHistorySuggestionsSupplier(getPanelDataSummary([stateFrame(STATUS_HISTORY_MAX_ROWS + 1)]))
    ).toBeUndefined();
  });

  it('narrows the cells and hides the legend in the preview only', () => {
    const [card] = statusHistorySuggestionsSupplier(getPanelDataSummary([stateFrame(3)]))!;
    const suggestion: { options?: Partial<PanelOptions> } = { options: { ...card.options } };
    card.cardOptions?.previewModifier?.(suggestion as never);
    expect(suggestion.options?.colWidth).toBe(STATUS_HISTORY_PREVIEW_COL_WIDTH);
    expect(suggestion.options?.legend?.showLegend).toBe(false);
    expect(card.options?.colWidth).toBeUndefined();
  });
});
