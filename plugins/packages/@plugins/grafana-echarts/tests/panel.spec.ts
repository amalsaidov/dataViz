import { test, expect } from '@grafana/plugin-e2e';

test('relations panel should explain why a frame without edges cannot be drawn', async ({
  gotoPanelEditPage,
  readProvisionedDashboard,
}) => {
  const dashboard = await readProvisionedDashboard({ fileName: 'relations/invalid-graph-frames.json' });
  const panelEditPage = await gotoPanelEditPage({ dashboard, id: '1' });
  await expect(panelEditPage.panel.locator).toContainText(
    'Graph data is missing edges. Add source and target labels to each numeric edge field.'
  );
});
