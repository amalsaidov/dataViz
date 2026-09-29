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

/** Editor category of the core Bar chart options. */
const category = [cartesianBarChartCategoryName];

/**
 * Register the core Bar chart panel options: Stacking, Orientation, "Highlight
 * full area on hover" and "Color by field". Core-parity controls, so they show in
 * every editor mode. Core: `public/app/plugins/panel/barchart/module.tsx`.
 * https://grafana.com/developers/plugin-tools/reference/plugin-json
 */
export function addCartesianBarChartOptions(builder: PanelOptionsEditorBuilder<PanelOptions>) {
  builder
    .addRadio({
      path: stackingPath,
      name: 'Stacking',
      description: 'Stack the bar series. A field can opt out with its own "Stacking" override.',
      category,
      defaultValue: StackingMode.None,
      settings: { options: stackingOptions },
    })
    .addRadio({
      path: orientationPath,
      name: 'Orientation',
      description: 'Auto draws horizontal bars when the panel is taller than it is wide. Category x-axis only.',
      category,
      defaultValue: CARTESIAN_ORIENTATION_DEFAULT,
      settings: { options: orientationOptions },
    })
    .addBooleanSwitch({
      path: fullHighlightPath,
      name: 'Highlight full area on hover',
      category,
      defaultValue: false,
      showIf: (options) => resolvePanelStacking(options) === StackingMode.None,
    })
    .addFieldNamePicker({
      path: colorByFieldPath,
      name: 'Color by field',
      description: 'Use the color value for a sibling field to color each bar value.',
      category,
    });
}
