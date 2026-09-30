import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { type PanelOptions } from 'types';
import { GeoMapViewEditor } from './GeoMapViewEditor';
import { DEFAULT_MAP_VIEW } from './mapView';

/** The group of the view editor, as core Geomap. */
export const geoViewCategoryName = 'Map view';

/**
 * The "Map view" group of core Geomap: one editor that writes the full `view` object.
 * Not here: `shared`, `noRepeat`, `dashboardVariable` and the layer choice of "Fit to data" (see `parity.md`).
 * Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/module.tsx
 * Custom editors: https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/custom-panel-option-editors
 */
export function addGeoViewOptions(
  builder: PanelOptionsEditorBuilder<PanelOptions>
): PanelOptionsEditorBuilder<PanelOptions> {
  return builder.addCustomEditor({
    category: [geoViewCategoryName],
    id: 'view',
    path: 'view',
    name: 'Initial view',
    description: 'This location will show when the panel first loads.',
    editor: GeoMapViewEditor,
    defaultValue: DEFAULT_MAP_VIEW,
  });
}
