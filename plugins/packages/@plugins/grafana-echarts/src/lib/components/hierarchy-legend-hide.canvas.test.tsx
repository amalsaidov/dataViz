import { FieldType, toDataFrame } from '@grafana/data';
import { SeriesVisibilityChangeMode } from '@grafana/ui';
import { toggleSeriesVisibilityConfig } from 'lib/grafana/fields/seriesConfig';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getComponent, getSeriesCanvasEvents, height, width } from 'test/panel';

// Baselines of a treemap and a sunburst with one top-level node hidden by the legend toggle (#955).
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

const renderHidden = async (seriesType: Parameters<typeof getComponent>[1]) => {
  const { container } = render(
    getComponent(
      [frame],
      seriesType,
      { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false } },
      undefined,
      undefined,
      'hierarchy',
      hideAdmin
    )
  );
  return getSeriesCanvasEvents(container);
};

describe('hierarchy legend hide canvas renders', () => {
  it('treemap without the hidden node', async () => {
    const { defaultEvents, seriesEvents } = await renderHidden('treemap');
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('sunburst without the hidden node', async () => {
    const { defaultEvents, seriesEvents } = await renderHidden('sunburst');
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });
});
