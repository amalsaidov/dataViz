import { FieldType, type VisualizationSuggestionsSupplier, VisualizationSuggestionScore } from '@grafana/data';
import { seriesTypePath } from 'editor/constants';
import { type EChartsTimelineFieldConfig } from 'editor/types';
import { previewCardOptions } from 'lib/echarts/charts/suggestionCards';
import { PREVIEW_MAX_ROWS } from 'lib/echarts/charts/suggestionLimits';
import { type PanelOptions } from 'types';

/** Core's limit: at 30 or more number fields, the lanes do not fit on the Y axis. */
export const TIMELINE_MAX_NUMBER_FIELDS = 30;

// Visualization Suggestions for the state timeline, with core's rules: a time field
// and a string or number field, fewer than 30 number fields, and no logs.
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-suggestions-support
export const stateTimelineSuggestionsSupplier: VisualizationSuggestionsSupplier<
  PanelOptions,
  EChartsTimelineFieldConfig
> = (dataSummary) => {
  if (
    !dataSummary.hasData ||
    !dataSummary.hasFieldType(FieldType.time) ||
    (!dataSummary.hasFieldType(FieldType.string) && !dataSummary.hasFieldType(FieldType.number)) ||
    dataSummary.fieldCountByType(FieldType.number) >= TIMELINE_MAX_NUMBER_FIELDS ||
    dataSummary.hasPreferredVisualisationType('logs')
  ) {
    return;
  }

  return [
    {
      name: 'State timeline',
      score: VisualizationSuggestionScore.OK,
      options: { [seriesTypePath]: 'custom' },
      cardOptions: previewCardOptions({ maxRows: PREVIEW_MAX_ROWS }),
    },
  ];
};
