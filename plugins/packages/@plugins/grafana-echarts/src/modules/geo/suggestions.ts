import {
  type PanelDataSummary,
  VisualizationSuggestionScore,
  type VisualizationSuggestionsSupplier,
} from '@grafana/data';
import { seriesTypePath } from 'editor/constants';
import { type EChartsFieldConfig } from 'editor/types';
import { previewCardOptions } from 'lib/echarts/charts/suggestionCards';
import { getFramePositions, getLocationMatchers } from 'lib/grafana/geo/location';
import { type PanelOptions } from 'types';

// The gate is here and not in `charts/fitness.ts` on purpose: the location matchers import the
// bundled gazetteer files (about 26 KB), and `fitness.ts` is shared by the entries of all panels.

/**
 * Geo fitness: the summary has data, and some frame gives positions with the default (Auto) matchers.
 * Core Geomap uses the same gate, and scores it `Best`:
 * https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/suggestions.ts
 */
export const scoreGeo = (summary: PanelDataSummary): VisualizationSuggestionScore | undefined => {
  if (!summary.hasData || !summary.rawFrames) {
    return undefined;
  }
  const matchers = getLocationMatchers();
  return summary.rawFrames.some((frame) => !getFramePositions(frame, matchers).warning)
    ? VisualizationSuggestionScore.Best
    : undefined;
};

// Visualization Suggestions for the geo family: data that the location matchers resolve by
// lat/lon fields, a geohash field or a lookup field. The data gate is `scoreGeo`.
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-suggestions-support
export const geoSuggestionsSupplier: VisualizationSuggestionsSupplier<PanelOptions, EChartsFieldConfig> = (
  dataSummary
) => {
  const score = scoreGeo(dataSummary);
  if (score == null) {
    return;
  }
  return [{ name: 'Geo', score, options: { [seriesTypePath]: 'map' }, cardOptions: previewCardOptions() }];
};
