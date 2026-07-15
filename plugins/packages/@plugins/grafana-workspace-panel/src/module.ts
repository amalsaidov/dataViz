import { PanelPlugin } from '@grafana/data';
import { WorkspacePanel } from './components/WorkspacePanel';
import type { WorkspacePanelOptions } from './types';

export const plugin = new PanelPlugin<WorkspacePanelOptions>(WorkspacePanel).setPanelOptions((builder) => {
	return builder
		.addBooleanSwitch({
			path: 'showSeriesCount',
			name: 'Show series count',
			defaultValue: true,
		})
		.addTextInput({
			path: 'seriesCountLabel',
			name: 'Series count label',
			defaultValue: 'Series',
			showIf: (config) => config.showSeriesCount,
		});
});
