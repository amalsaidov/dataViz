import { type DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { VizOrientation } from '@grafana/schema';
import { render } from '@testing-library/react';
import { AXIS_ZLEVEL, normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getAxisCanvasEvents, getComponent, height } from 'test/panel';
import { type PanelOptions } from 'types';

// Canvas baselines of the x labels of category bars and of the histogram at a narrow width (#1014).
// The claims are in `x-tick-overlap.integration.test.tsx`.

const NARROW = 200;

const hosts = (): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'host', type: FieldType.string, values: Array.from({ length: 12 }, (_, i) => `server-${i + 1}.example`) },
      { name: 'value', type: FieldType.number, values: Array.from({ length: 12 }, (_, i) => i + 1) },
    ],
  });

const requests = (): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: Array.from({ length: 40 }, (_, i) => i * 60_000) },
      {
        name: 'Requests',
        type: FieldType.number,
        values: Array.from({ length: 40 }, (_, i) => 100000 + i * 250),
        config: { unit: 'suffix: requests' },
      },
    ],
  });

const renderNarrow = async (frame: DataFrame, options: Partial<PanelOptions>) => {
  const { container } = render(
    getComponent(
      [frame],
      'bar',
      {
        zLevel: { series: SERIES_ZLEVEL, axis: AXIS_ZLEVEL },
        animation: { enabled: false },
        editorMode: 'advanced',
        ...options,
      },
      undefined,
      { width: NARROW }
    )
  );
  return getAxisCanvasEvents(container);
};

describe('x labels at a narrow width', () => {
  it('draws category bars with a minimum label spacing', async () => {
    const { defaultEvents, axisEvents, seriesEvents } = await renderNarrow(hosts(), {
      orientation: VizOrientation.Vertical,
      xTickLabelSpacing: 10,
    });
    expect(normalizeCanvasEvents([...axisEvents, ...seriesEvents])).toMatchCanvasSnapshot(defaultEvents, {
      width: NARROW,
      height,
    });
  });

  it('draws a histogram', async () => {
    const { defaultEvents, axisEvents, seriesEvents } = await renderNarrow(requests(), { histogram: true });
    expect(normalizeCanvasEvents([...axisEvents, ...seriesEvents])).toMatchCanvasSnapshot(defaultEvents, {
      width: NARROW,
      height,
    });
  });
});
