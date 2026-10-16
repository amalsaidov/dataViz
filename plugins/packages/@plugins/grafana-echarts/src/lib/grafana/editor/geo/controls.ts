import { type PanelOptionsEditorBuilder } from '@grafana/data';
import { type PanelOptions } from 'types';

/** The group of the map controls, as core Geomap. */
const category = ['Map controls'];

/**
 * The "Map controls" options of core Geomap that this panel reads: the zoom switches and the tooltip mode.
 * Not here: the attribution, scale, measure and debug switches (see `src/modules/geo/parity.md`).
 * Core: https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/geomap/module.tsx
 * Builder API: https://grafana.com/developers/plugin-tools/how-to-guides/panel-plugins/add-support-for-panel-options
 */
export function addGeoControlsOptions(builder: PanelOptionsEditorBuilder<PanelOptions>): void {
  builder
    .addBooleanSwitch({
      category,
      path: 'controls.showZoom',
      // Core shows the buttons in the upper left corner. `ChartZoomControls` shows them in the lower right corner.
      description: 'Show zoom control buttons in the lower right corner',
      name: 'Show zoom control',
      defaultValue: true,
    })
    .addBooleanSwitch({
      category,
      path: 'controls.mouseWheelZoom',
      description: 'Enable zoom control via mouse wheel',
      name: 'Mouse wheel zoom',
      defaultValue: true,
    })
    .addRadio({
      category,
      path: 'tooltip.mode',
      name: 'Tooltip',
      description: 'Show the tooltip on hover, or on click only',
      // The values of the core `TooltipMode` of Geomap.
      defaultValue: 'details',
      settings: {
        options: [
          { label: 'None', value: 'none', description: 'Show contents on click, not hover' },
          { label: 'Details', value: 'details', description: 'Show popup on hover' },
        ],
      },
    });
}
