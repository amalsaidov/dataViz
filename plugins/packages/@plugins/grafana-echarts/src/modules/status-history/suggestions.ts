import { type VisualizationSuggestionsSupplier } from '@grafana/data';
import { seriesTypePath } from 'editor/constants';
import { type EChartsTimelineFieldConfig } from 'editor/types';
import { scoreTimeline } from 'lib/echarts/charts/fitness';
import { previewCardOptions } from 'lib/echarts/charts/suggestionCards';
import { PREVIEW_MAX_ROWS, STATUS_HISTORY_MAX_ROWS } from 'lib/echarts/charts/suggestionLimits';
import { type PanelOptions } from 'types';

/** Core's preview column width, narrower than the 0.9 default (`status-history/module.tsx`). */
export const STATUS_HISTORY_PREVIEW_COL_WIDTH = 0.7;

// Visualization Suggestions for the status history, with core's rules: the state
// timeline rules plus at most 100 rows per frame, because each row is one cell
// (`scoreTimeline`, charts/fitness.ts). The preview hides the legend, as the shared
// card options do, and narrows the cells.
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-suggestions-support
export const statusHistorySuggestionsSupplier: VisualizationSuggestionsSupplier<
  PanelOptions,
  EChartsTimelineFieldConfig
> = (dataSummary) => {
  const score = scoreTimeline(dataSummary, STATUS_HISTORY_MAX_ROWS);
  if (score == null) {
    return;
  }

  return [
    {
      name: 'Status history',
      score,
      options: { [seriesTypePath]: 'custom' },
      cardOptions: previewCardOptions({
        maxRows: PREVIEW_MAX_ROWS,
        options: { colWidth: STATUS_HISTORY_PREVIEW_COL_WIDTH },
      }),
    },
  ];
};
