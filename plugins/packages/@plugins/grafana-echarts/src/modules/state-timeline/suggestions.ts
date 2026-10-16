import { type VisualizationSuggestionsSupplier } from '@grafana/data';
import { seriesTypePath } from 'editor/constants';
import { type EChartsTimelineFieldConfig } from 'editor/types';
import { scoreTimeline } from 'lib/echarts/charts/fitness';
import { previewCardOptions } from 'lib/echarts/charts/suggestionCards';
import { PREVIEW_MAX_ROWS } from 'lib/echarts/charts/suggestionLimits';
import { type PanelOptions } from 'types';

// Visualization Suggestions for the state timeline, with core's rules: a time field
// and a string or number field, fewer than 30 number fields, and no logs
// (`scoreTimeline`, charts/fitness.ts).
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-suggestions-support
export const stateTimelineSuggestionsSupplier: VisualizationSuggestionsSupplier<
  PanelOptions,
  EChartsTimelineFieldConfig
> = (dataSummary) => {
  const score = scoreTimeline(dataSummary);
  if (score == null) {
    return;
  }

  return [
    {
      name: 'State timeline',
      score,
      options: { [seriesTypePath]: 'custom' },
      cardOptions: previewCardOptions({ maxRows: PREVIEW_MAX_ROWS }),
    },
  ];
};
