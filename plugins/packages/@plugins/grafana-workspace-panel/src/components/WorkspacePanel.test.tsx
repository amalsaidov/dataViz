import { render, screen } from '@testing-library/react';
import type { PanelProps } from '@grafana/data';
import { WorkspacePanel } from './WorkspacePanel';
import type { WorkspacePanelOptions } from '../types';

type Props = PanelProps<WorkspacePanelOptions>;

// Only the props WorkspacePanel actually reads; the rest of PanelProps is a
// large surface we don't need for a render smoke test.
function makeProps(overrides: Partial<Props> = {}): Props {
	return {
		options: { showSeriesCount: true, seriesCountLabel: 'Series' },
		data: { series: [] },
		width: 400,
		height: 300,
		...overrides,
	} as Props;
}

describe('WorkspacePanel', () => {
	it('renders the shared formatMessage output', () => {
		// Also proves the @shared/core workspace import resolves under Jest.
		render(<WorkspacePanel {...makeProps()} />);

		expect(screen.getByText('[Workspace] Workspace panel')).toBeInTheDocument();
	});

	it('shows the series count when showSeriesCount is true', () => {
		const data = { series: [{}, {}] } as Props['data'];
		render(<WorkspacePanel {...makeProps({ data })} />);

		expect(screen.getByText('Series:')).toBeInTheDocument();
		expect(screen.getByText('2')).toBeInTheDocument();
	});

	it('hides the series count when showSeriesCount is false', () => {
		const options = { showSeriesCount: false, seriesCountLabel: 'Series' };
		render(<WorkspacePanel {...makeProps({ options })} />);

		expect(screen.queryByText('Series:')).not.toBeInTheDocument();
	});
});
