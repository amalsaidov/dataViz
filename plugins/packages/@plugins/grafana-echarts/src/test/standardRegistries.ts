// Fills the editor registry that Grafana core fills before it loads a panel plugin. Outside Grafana it is empty, and
// the option builders throw when they add an option with an editor id that is not there. Import this file before a
// `module.tsx` in a test that builds the plugin options, for example with `getPanelOptionsWithDefaults`.
// Grafana core registers the editors in `getAllOptionEditors`:
// https://github.com/grafana/grafana/blob/main/public/app/core/components/OptionsUI/registry.tsx
import { type StandardEditorsRegistryItem, standardEditorsRegistry } from '@grafana/data';

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
