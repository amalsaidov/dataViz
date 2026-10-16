import { FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent } from 'test/panel';
import { type PanelOptions } from 'types';

// A field value of Line width, Fill opacity, Point size or Show points draws the series as the same value
// of the panel option does (#534). Core Time series reads these settings per field:
// https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/time-series/#graph-styles

const START = 1783137094497;
const PANEL: Partial<PanelOptions> = {
  lineWidth: 1,
  fillOpacity: 0,
  pointSize: 5,
  performance: { showPoints: 'never' },
};

const seriesEvents = async (custom: Record<string, unknown>, options: Partial<PanelOptions>) => {
  const frame = toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: [0, 1, 2, 3].map((i) => START + i * 30 * 60_000) },
      { name: 'a', type: FieldType.number, values: [1, 3, 2, 4], config: { custom } },
    ],
  });
  const { container, unmount } = render(
    getComponent([frame], 'line', { ...options, zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false } })
  );
  const events = normalizeCanvasEvents((await getCanvasEvents(container)).seriesEvents);
  unmount();
  return events;
};

describe('cartesian per-field series style', () => {
  it.each([
    ['Line width', { lineWidth: 4 }, { lineWidth: 4 }],
    ['Fill opacity', { fillOpacity: 30 }, { fillOpacity: 30 }],
    [
      'Point size and Show points',
      { pointSize: 12, showPoints: 'always' },
      { pointSize: 12, performance: { showPoints: 'always' } },
    ],
  ] as const)('draws the field %s as the panel option', async (_, custom, option) => {
    const fromField = await seriesEvents(custom, PANEL);
    const fromPanel = await seriesEvents({}, { ...PANEL, ...option } as Partial<PanelOptions>);
    expect(fromField).toEqual(fromPanel);
    // The field value changes the render.
    expect(fromField).not.toEqual(await seriesEvents({}, PANEL));
  });
});
