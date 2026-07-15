import React from 'react';
import { PluginPage } from '@grafana/runtime';
import { Alert, Button } from '@grafana/ui';
import { formatMessage } from '@shared/core';

export function App(): React.ReactElement {
	const [count, setCount] = React.useState(0);

	return (
		<PluginPage>
			<Alert title="Welcome to Workspace" severity="info">
				<p>{formatMessage('This is a minimal Grafana plugin built with the ejected plugin structure.')}</p>
			</Alert>

			<div style={{ marginTop: '20px' }}>
				<h2>Demo counter</h2>
				<p>Count: {count}</p>
				<Button onClick={() => setCount(count + 1)}>Increment</Button>
			</div>
		</PluginPage>
	);
}
