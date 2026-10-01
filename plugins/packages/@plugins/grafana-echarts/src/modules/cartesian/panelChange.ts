// The panel change handler of the cartesian panel: a switch from core Time series keeps its options and overrides.
// https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/migration-handler-for-panels
// The mapping is the Time series adapter in lib/grafana/panelChange.
import { type FieldConfigSource, type PanelModel } from '@grafana/data';
import { timeseriesAdapter } from 'lib/grafana/panelChange/timeseries';

/**
 * The options after a change from `prevPluginId`. For core Time series, it also changes `panel.fieldConfig`, because
 * the type change clears the custom field config. For each other type, it changes nothing.
 * Scenes `VizPanel.changePluginType` reads no field config back from the handler, but `panel.fieldConfig` is its
 * state object. So the handler changes that object in place, and the next options change applies it.
 * https://github.com/grafana/scenes/blob/main/packages/scenes/src/components/VizPanel/VizPanel.tsx
 */
export function cartesianPanelChangeHandler(
  panel: PanelModel,
  prevPluginId: string,
  prevOptions: Record<string, unknown>,
  prevFieldConfig: FieldConfigSource
): Record<string, unknown> {
  if (prevPluginId !== 'timeseries') {
    // Scenes keeps the options for an empty result.
    return {};
  }
  const imported = timeseriesAdapter.translate({
    type: prevPluginId,
    options: prevOptions,
    fieldConfig: { defaults: { ...prevFieldConfig.defaults }, overrides: prevFieldConfig.overrides },
  });
  Object.assign(panel.fieldConfig, imported.fieldConfig);
  return imported.options;
}
