import { PanelOptionsEditorBuilder, type StandardEditorContext } from '@grafana/data';
import { initPluginTranslations } from '@grafana/i18n';
import 'test/standardRegistries';
import { type PanelOptions } from 'types';

jest.mock('@grafana/i18n', () => ({
  initPluginTranslations: jest.fn(),
  t: (key: string) => key,
}));

describe('Heatmap plugin module', () => {
  it('initializes translations with the webpack-selected plugin ID', async () => {
    (globalThis as typeof globalThis & { __PLUGIN_ID__?: string }).__PLUGIN_ID__ = 'grafana-echarts-app';

    await import('./module');

    expect(initPluginTranslations).toHaveBeenCalledWith('grafana-echarts-app');
  });
});

describe('heatmap module', () => {
  // The showIf of an option of the heatmap plugin, from the options that its supplier adds.
  // https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/panel/PanelPlugin.ts
  const showIfOf = async (path: string) => {
    const { plugin } = await import('./module');
    const builder = new PanelOptionsEditorBuilder<PanelOptions>();
    plugin.getPanelOptionsSupplier()(builder, { data: [] } as StandardEditorContext<PanelOptions>);
    return builder.getItems().find((item) => item.path === path)?.showIf!;
  };
  const options = (heatmapLayout: string, mode: string) =>
    ({ heatmapLayout, color: { mode } }) as unknown as PanelOptions;

  it('shows the heatmap color scheme in the Matrix layout for each color mode', async () => {
    const showIf = await showIfOf('heatmapColorScheme');
    expect(showIf(options('matrix', 'opacity'))).toBe(true);
    expect(showIf(options('matrix', 'scheme'))).toBe(true);
  });

  it('hides the heatmap color scheme in the Binned layout with the opacity mode', async () => {
    const showIf = await showIfOf('heatmapColorScheme');
    expect(showIf(options('binned', 'opacity'))).toBe(false);
    expect(showIf(options('binned', 'scheme'))).toBe(true);
  });
});
