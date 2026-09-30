import { type PanelOptionsEditorBuilder } from '@grafana/data';

/**
 * The descriptions of the options that `commonOptionsBuilder` of `@grafana/ui` adds with no description. The drop
 * file viz-options.json gives them to the producers (viz contract, section 24).
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/options/builder/legend.tsx
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/options/builder/tooltip.tsx
 */
const COMMON_DESCRIPTIONS: Readonly<Record<string, string>> = {
  'legend.showLegend': 'Show the legend.',
  'legend.displayMode': 'List: the series names. Table: the series names and their values.',
  'legend.placement': 'The position of the legend.',
  'legend.width': 'The width of the legend on the right, in pixels. Empty picks a width.',
  'legend.overflow': 'How the table legend shows a long name: cut it with an ellipsis, or wrap it.',
  'tooltip.mode': 'Single: the series under the pointer. All: each series. Hidden: no tooltip.',
  'tooltip.sort': 'The order of the series in the tooltip in All mode.',
  'tooltip.hideZeros': 'Do not show the series with a value of zero in the tooltip.',
  'tooltip.maxWidth': 'The maximum width of the tooltip, in pixels.',
  'tooltip.maxHeight': 'The maximum height of the tooltip, in pixels.',
  'text.valueSize': 'The font size of the value text, in pixels. Empty picks a size.',
};

/** Gives each option of `COMMON_DESCRIPTIONS` that has no description its description. */
export function describeCommonOptions<T>(builder: PanelOptionsEditorBuilder<T>): void {
  for (const item of builder.getItems()) {
    item.description ||= COMMON_DESCRIPTIONS[item.path];
  }
}
