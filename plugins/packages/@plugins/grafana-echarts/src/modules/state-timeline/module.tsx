import { FieldColorModeId, FieldConfigProperty, PanelPlugin } from '@grafana/data';
import { type EChartsTimelineFieldConfig } from 'editor/types';
import { makeLazyPanel } from 'lib/components/LazyPanel';
import { STANDARD_FILTERABLE_OPTION } from 'lib/grafana/editor/common/fieldConfig';
import { addCommonLegendAndTooltip } from 'lib/grafana/editor/common/legend-and-tooltip';
import {
  addAlignValueOption,
  addFillOpacityFieldOption,
  addLineWidthFieldOption,
  addMergeValuesOption,
  addNullsFieldOptions,
  addRowHeightOption,
  addShowValueOption,
} from 'lib/grafana/editor/timeline/core-options';
import { type PanelOptions } from 'types';
import { stateTimelineSuggestionsSupplier } from './suggestions';

const category = ['State timeline'];

// State timeline panel: one lane per value field, one bar per state, drawn by the
// timeline family (`lib/echarts/charts/timeline.ts`) with an ECharts `custom` series.
// Options, paths and defaults are core's state timeline ones:
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/state-timeline/module.tsx
export const plugin = new PanelPlugin<PanelOptions, EChartsTimelineFieldConfig>(makeLazyPanel('timeline'))
  .useFieldConfig({
    standardOptions: {
      // Core's default: a continuous green-yellow-red scheme, with value mappings for states.
      [FieldConfigProperty.Color]: {
        settings: { byValueSupport: true },
        defaultValue: { mode: FieldColorModeId.ContinuousGrYlRd },
      },
      [FieldConfigProperty.Filterable]: STANDARD_FILTERABLE_OPTION,
    },
    useCustomConfig: (builder) => {
      addLineWidthFieldOption(builder, category);
      addFillOpacityFieldOption(builder, category);
      addNullsFieldOptions(builder, category);
    },
  })
  .setPanelOptions((builder) => {
    addMergeValuesOption(builder, category);
    addShowValueOption(builder, category);
    addAlignValueOption(builder, category);
    addRowHeightOption(builder, category);
    // Legend calcs are off: the legend lists states, as core's (`addLegendOptions(builder, false)`).
    addCommonLegendAndTooltip(builder, { includeLegendCalcs: false });
    return builder;
  })
  .setSuggestionsSupplier(stateTimelineSuggestionsSupplier);
