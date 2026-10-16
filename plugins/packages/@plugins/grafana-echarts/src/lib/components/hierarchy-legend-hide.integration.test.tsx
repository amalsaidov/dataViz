import { type FieldConfigSource, FieldType, toDataFrame } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';
import { toggleSeriesVisibilityConfig } from 'lib/grafana/fields/seriesConfig';
import { render } from '@testing-library/react';
import { getChart } from 'test/canvas';
import { getComponent, waitForFinished } from 'test/panel';
import { tileBox } from 'test/treemap';

// A legend click hides a top-level node of a treemap, as a core pie hides a slice (#955).
// Each test compares the render with and without the `hideSeriesFrom` override.
// https://grafana.com/docs/grafana/latest/panels-visualizations/configure-legend/#isolate-series-data-in-a-visualization
const frame = toDataFrame({
  fields: [
    { name: 'category', type: FieldType.string, values: ['Sales', 'Admin', 'IT'] },
    { name: 'value', type: FieldType.number, values: [43, 10, 30] },
  ],
});

// The override that a ctrl-click on the `Admin` legend item writes.
const hideAdmin = toggleSeriesVisibilityConfig(
  { defaults: {}, overrides: [] },
  'Admin',
  SeriesVisibilityChangeMode.AppendToSelection,
  ['Sales', 'Admin', 'IT']
);

// A plain click on the `Admin` legend item: isolate it.
const isolateAdmin = toggleSeriesVisibilityConfig(
  { defaults: {}, overrides: [] },
  'Admin',
  SeriesVisibilityChangeMode.ToggleSelection,
  ['Sales', 'Admin', 'IT']
);

const renderTreemap = async (fieldConfig?: FieldConfigSource) => {
  const { container, unmount } = render(
    getComponent([frame], 'treemap', { animation: { enabled: false } }, undefined, undefined, 'hierarchy', fieldConfig)
  );
  const chart = getChart(container).chart!;
  await waitForFinished(chart);
  return { chart, unmount };
};

type TreeOption = { series: Array<{ data: Array<{ name: string; itemStyle?: { color?: string } }> }> };
const tileColor = (chart: Awaited<ReturnType<typeof renderTreemap>>['chart'], name: string) =>
  (chart.getOption() as unknown as TreeOption).series[0].data.find((item) => item.name === name)?.itemStyle?.color;

describe('hierarchy legend hide', () => {
  it('drops the hidden node and keeps the color of the other nodes', async () => {
    const shown = await renderTreemap();
    const shownColor = tileColor(shown.chart, 'IT');
    expect(tileBox(shown.chart, 'Admin')).toBeDefined();
    shown.unmount();

    const hidden = await renderTreemap(hideAdmin);
    expect(tileBox(hidden.chart, 'Admin')).toBeUndefined();
    expect(tileBox(hidden.chart, 'Sales')).toBeDefined();
    expect(tileColor(hidden.chart, 'IT')).toBe(shownColor);
  });

  // Before #955 the isolate override hid the value field, and the panel drew nothing.
  it('draws only the isolated node after a plain click', async () => {
    const { chart } = await renderTreemap(isolateAdmin);
    expect(tileBox(chart, 'Admin')).toBeDefined();
    expect(tileBox(chart, 'Sales')).toBeUndefined();
    expect(tileBox(chart, 'IT')).toBeUndefined();
  });
});
