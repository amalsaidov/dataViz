// The types of the panel change from a core panel to an ECharts panel.
// This directory has no ECharts code. It changes Grafana panel settings into the settings of an ECharts panel.
// Panel JSON model: https://grafana.com/docs/grafana/latest/dashboards/build-dashboards/view-dashboard-json-model/#panels
import type { FieldConfigSource } from '@grafana/data';

/** One property of an override: https://grafana.com/docs/grafana/latest/panels-visualizations/configure-overrides/ */
export interface CoreOverrideProperty {
  id: string;
  value?: unknown;
}

/** One entry of `fieldConfig.overrides` of a core panel. The import reads only its properties. */
export interface CoreOverride {
  matcher?: unknown;
  properties?: CoreOverrideProperty[];
}

/** The settings of the core panel, as the dashboard has them. */
export interface CorePanel {
  type: string;
  options?: Record<string, unknown>;
  fieldConfig?: {
    defaults?: Record<string, unknown>;
    overrides?: CoreOverride[];
  };
  [key: string]: unknown;
}

/** The status of a setting. */
export type SettingStatus = 'supported' | 'ignored' | 'cosmetic' | 'unsupported';

/** A setting entry of the capability file. */
export interface SettingEntry {
  status: SettingStatus;
  /** Key: the string for a string value, else the JSON text of the value. */
  values?: Record<string, SettingStatus>;
  /** Paths from the panel root that start with `options.` or `fieldConfig.defaults.`, each with a list of values. */
  ignoredWhen?: Record<string, Array<string | number | boolean | null>>;
  /** The status of a value of an override property. It replaces `status` and `values`. */
  overrideStatus?: SettingStatus;
  note?: string;
}

/** The capability file of one core panel type: the status of each setting that the adapter reads. */
export interface ImportPanelCapability {
  source: string;
  target: string;
  options: Record<string, SettingEntry>;
  fieldConfig: Record<string, SettingEntry>;
}

/** The settings of the ECharts panel that an adapter makes. */
export interface ImportedPanel {
  type: string;
  options: Record<string, unknown>;
  fieldConfig: FieldConfigSource;
}

/** The adapter of one core panel type. */
export interface ImportAdapter {
  /** The capability file of this core panel type. */
  capability: ImportPanelCapability;
  /** Makes the ECharts panel. It does not change `panel`. */
  translate(panel: CorePanel): ImportedPanel;
}
