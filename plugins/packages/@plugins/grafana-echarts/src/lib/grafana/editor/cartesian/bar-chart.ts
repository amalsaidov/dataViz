import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import {
  CARTESIAN_ORIENTATION_DEFAULT,
  cartesianBarChartCategoryName,
  colorByFieldPath,
  fullHighlightPath,
  orientationOptions,
  orientationPath,
  stackingOptions,
  stackingPath,
} from 'editor/cartesian';
import { resolvePanelStacking } from 'lib/echarts/options/bars';
import { type PanelOptions } from 'types';
import { showIfBarOption, showIfSeriesTypes } from './series-types';

/** Editor category of the core Bar chart options. */
const category = [cartesianBarChartCategoryName];

/**
 * Register the core Bar chart panel options: Stacking, Orientation, "Highlight
 * full area on hover" and "Color by field". Core-parity controls, so they show in
 * every editor mode. Stacking shows for a bar or line series and in histogram mode. The others show only for a bar series outside
 * histogram mode (`showIfBarOption`). Core: `public/app/plugins/panel/barchart/module.tsx`.
 * https://grafana.com/developers/plugin-tools/reference/plugin-json
 */
export function addCartesianBarChartOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder
    .addRadio({
      path: stackingPath,
      name: 'Stacking',
      description:
        'Stack the bar series, and the line and area series of a time axis. A field can opt out with its own "Stacking" override.',
      category,
      defaultValue: StackingMode.None,
      settings: { options: stackingOptions },
      // Histogram mode stacks its bars too (`histogramStyle.ts`).
      showIf: showIfSeriesTypes(['bar', 'line'], { histogram: true }),
    })
    .addRadio({
      path: orientationPath,
      name: 'Orientation',
      description: 'Auto draws horizontal bars when the panel is taller than it is wide. Category x-axis only.',
      category,
      defaultValue: CARTESIAN_ORIENTATION_DEFAULT,
      settings: { options: orientationOptions },
      showIf: showIfBarOption,
    })
    .addBooleanSwitch({
      path: fullHighlightPath,
      name: 'Highlight full area on hover',
      description: 'On hover, highlight the full area of the category, not only the bar.',
      category,
      defaultValue: false,
      showIf: (options, ...rest) =>
        resolvePanelStacking(options) === StackingMode.None && showIfBarOption(options, ...rest),
    })
    .addFieldNamePicker({
      path: colorByFieldPath,
      name: 'Color by field',
      description: 'Use the color value for a sibling field to color each bar value.',
      category,
      showIf: showIfBarOption,
    });
}
