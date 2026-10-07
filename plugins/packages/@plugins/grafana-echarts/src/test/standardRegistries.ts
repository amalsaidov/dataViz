// Fills the two registries that Grafana core fills before it loads a panel plugin. Outside Grafana both are empty:
// the option builders throw when they add an option with an editor id that is not there, and
// `plugin.fieldConfigRegistry` has no standard properties. Import this file before a `module.tsx` in a test that
// builds the plugin options, for example with `getPanelOptionsWithDefaults`.
// Grafana core registers the editors in `getAllOptionEditors`:
// https://github.com/grafana/grafana/blob/main/public/app/core/components/OptionsUI/registry.tsx
import {
  type StandardEditorsRegistryItem,
  standardEditorsRegistry,
  standardFieldConfigEditorRegistry,
} from '@grafana/data';
import { standardFieldConfigRegistry } from './fieldConfigRegistry';

/** The editor ids that the `module.tsx` files use. A test does not render the editors, so each one is empty. */
const EDITOR_IDS = [
  'select',
  'radio',
  'boolean',
  'number',
  'text',
  'slider',
  'color',
  'unit',
  'thresholds',
  'mappings',
  'links',
  'fieldColor',
  'stats-picker',
  'multiSelect',
  'custom',
  'strings',
  'timezone',
  'interval',
  'field-name',
  'dashboard-uid',
  'reduce',
  'multi-select',
];

const noEditor = () => null;

standardEditorsRegistry.setInit(() =>
  EDITOR_IDS.map((id): StandardEditorsRegistryItem => ({ id, name: id, editor: noEditor }))
);
// `PanelPlugin.useFieldConfig` copies these items into `plugin.fieldConfigRegistry`, with the plugin's own defaults.
standardFieldConfigEditorRegistry.setInit(() => standardFieldConfigRegistry.list());
