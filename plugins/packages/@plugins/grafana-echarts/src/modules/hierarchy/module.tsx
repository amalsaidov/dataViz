import { PanelPlugin } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import { commonOptionsBuilder } from '@grafana/ui';
import { hierarchySeriesTypeOptions, seriesTypePath } from 'editor/constants';
import { type EChartsFieldConfig } from 'editor/types';
import { makeLazyPanel } from 'lib/components/LazyPanel';
import { describeCommonOptions } from 'lib/grafana/editor/common/describe-common-options';
import { STANDARD_FIELD_OPTIONS } from 'lib/grafana/editor/common/fieldConfig';
import { type PanelOptions } from 'types';
import { hierarchySuggestionsSupplier } from './suggestions';

// Initialize i18n before the option builders below call `t()`. Every module is
// its own webpack entry (see getEntries in .config/bundler/utils.ts), so
// Grafana can load this panel without any other module having run.
declare const __PLUGIN_ID__: string;

initPluginTranslations(__PLUGIN_ID__);

// Hierarchy family panel: a value-weighted tree rendered as a treemap (nested
// rectangles) or sunburst (radial rings). Both variants share the same tree
// model, reconstructed from a flame-graph nested-set frame or a flat categorical
// frame (see echarts/converters/hierarchy.ts). The panel-level `seriesType`
// picks the render variant.
export const plugin = new PanelPlugin<PanelOptions, EChartsFieldConfig>(makeLazyPanel('hierarchy'))
  .useFieldConfig({
    standardOptions: STANDARD_FIELD_OPTIONS,
    // Register `custom.hideFrom` so Grafana keeps the legend visibility override
    // (it skips unregistered override properties). The chart reads the hidden
    // top-level nodes by name (see `lib/grafana/fields/seriesConfig.ts`).
    // https://grafana.com/docs/grafana/latest/panels-visualizations/configure-legend/
    useCustomConfig: (builder) => {
      commonOptionsBuilder.addHideFrom(builder);
    },
  })
  .setPanelOptions((builder) => {
    // Panel-level render variant: treemap vs sunburst.
    builder.addRadio({
      path: seriesTypePath,
      name: 'Chart type',
      description: 'The chart that shows the hierarchy.',
      category: ['Hierarchy'],
      defaultValue: 'treemap',
      settings: {
        options: hierarchySeriesTypeOptions,
      },
    });

    commonOptionsBuilder.addLegendOptions(builder);
    // `singleOnly`: a hierarchy hover is always one node, so "All" has nothing to
    // list. Note `hierarchyChartModule` does *not* set `singleTooltipOnly`, so a
    // dashboard saved with `multi` before this still builds an axis trigger; see
    // `ChartModule.singleTooltipOnly`.
    commonOptionsBuilder.addTooltipOptions(builder, true);
    describeCommonOptions(builder);

    return builder;
  })
  // Advertise fitness for numeric/instant data (flat categorical path).
  .setSuggestionsSupplier(hierarchySuggestionsSupplier);
