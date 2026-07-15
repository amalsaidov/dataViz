import type React from 'react';
import type { PanelProps } from '@grafana/data';
import { useTheme2 } from '@grafana/ui';
import { formatMessage } from '@shared/core';
import type { WorkspacePanelOptions } from '../types';

type Props = PanelProps<WorkspacePanelOptions>;

export function WorkspacePanel({ options, data, width, height }: Props): React.ReactElement {
	const theme = useTheme2();
	const seriesCount = data.series.length;

	return (
		<div style={{ width, height, overflow: 'auto', padding: theme.spacing(1) }}>
			<div style={{ color: theme.colors.text.secondary, fontSize: theme.typography.bodySmall.fontSize }}>
				{formatMessage('Workspace panel')}
			</div>

			{options.showSeriesCount ? (
				<div style={{ marginTop: theme.spacing(1), color: theme.colors.text.primary }}>
					<span>{options.seriesCountLabel}: </span>
					<strong>{seriesCount}</strong>
				</div>
			) : null}
		</div>
	);
}
