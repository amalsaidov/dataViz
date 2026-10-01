import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { STATUS_HISTORY_LINE_WIDTH_DEFAULT } from 'editor/timeline';
import { type EChartsTimelineFieldConfig } from 'editor/types';
import { makeLazyPanel } from 'lib/components/LazyPanel';
import { STANDARD_FILTERABLE_OPTION } from 'lib/grafana/editor/common/fieldConfig';
import { addCommonLegendAndTooltip } from 'lib/grafana/editor/common/legend-and-tooltip';
import {
  addColWidthOption,
  addFillOpacityFieldOption,
  addLineWidthFieldOption,
  addRowHeightOption,
  addShowValueOption,
} from 'lib/grafana/editor/timeline/core-options';
import { type PanelOptions } from 'types';
import { statusHistorySuggestionsSupplier } from './suggestions';

const category = ['Status history'];

// Status history panel: one lane per value field, one cell per sample. The
// `status-history` family draws core's Samples mode with the timeline chart module
// (`lib/echarts/charts/timeline.ts`). Options, paths and defaults are core's status
// history ones; it has no merge and no text alignment:
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/status-history/module.tsx
export const plugin = new PanelPlugin<PanelOptions, EChartsTimelineFieldConfig>(makeLazyPanel('status-history'))
  .useFieldConfig({
    standardOptions: {
      // Core's default: threshold colours.
      [FieldConfigProperty.Color]: {
        settings: { byValueSupport: true },
        defaultValue: { mode: FieldColorModeId.Thresholds },
      },
      [FieldConfigProperty.Filterable]: STANDARD_FILTERABLE_OPTION,
    },
    useCustomConfig: (builder) => {
      addLineWidthFieldOption(builder, category, STATUS_HISTORY_LINE_WIDTH_DEFAULT);
      addFillOpacityFieldOption(builder, category);
    },
  })
  .setPanelOptions((builder) => {
    addShowValueOption(builder, category);
    addRowHeightOption(builder, category);
    addColWidthOption(builder, category);
    // Legend calcs are off: the legend lists states, as core's (`addLegendOptions(builder, false)`).
    addCommonLegendAndTooltip(builder, { includeLegendCalcs: false });
    return builder;
  })
  .setSuggestionsSupplier(statusHistorySuggestionsSupplier);
