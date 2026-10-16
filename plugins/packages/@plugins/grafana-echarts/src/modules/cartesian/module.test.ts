import { initPluginTranslations } from '@grafana/i18n';

jest.mock('@grafana/i18n', () => ({
  initPluginTranslations: jest.fn(),
  t: (key: string) => key,
}));

describe('Cartesian plugin module', () => {
  it('initializes translations with the webpack-selected plugin ID', async () => {
    (globalThis as typeof globalThis & { __PLUGIN_ID__?: string }).__PLUGIN_ID__ = 'grafana-echarts-app';

    await import('./module');

    expect(initPluginTranslations).toHaveBeenCalledWith('grafana-echarts-app');
  });

  it('asks for the dashboard annotations, as core Time series', async () => {
    (globalThis as typeof globalThis & { __PLUGIN_ID__?: string }).__PLUGIN_ID__ = 'grafana-echarts-app';
    const { plugin } = await import('./module');

    // A Scenes dashboard removes `data.annotations` for a panel plugin with no annotation support.
    expect(plugin.dataSupport.annotations).toBe(true);
  });
});
