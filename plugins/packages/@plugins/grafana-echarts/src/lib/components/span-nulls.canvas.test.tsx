import { FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent, height, width } from 'test/panel';

// Canvas baselines of "Connect null values" (`custom.spanNulls`) on a cartesian line series with a
// 1-row and a 3-row null run. The claims are in `span-nulls.integration.test.tsx`.

// 20 minutes between rows, so the 10 rows fill the 3 h test time range.
const STEP = 20 * 60_000;
const values = [10, 30, null, 20, 40, null, null, null, 30, 10];

const renderEvents = async (spanNulls: boolean | number) => {
  const frame = toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: values.map((_, i) => 1783137094497 + i * STEP) },
      { name: 'cpu', type: FieldType.number, values, config: { custom: { spanNulls } } },
    ],
  });
  const { container } = render(
    getComponent([frame], 'line', { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false } })
  );
  return getCanvasEvents(container);
};

describe('cartesian Connect null values', () => {
  it('breaks the line at each null (Never)', async () => {
    const { defaultEvents, seriesEvents } = await renderEvents(false);
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('connects the line over each null (Always)', async () => {
    const { defaultEvents, seriesEvents } = await renderEvents(true);
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('connects only the 40 min gap with a 60 min threshold', async () => {
    const { defaultEvents, seriesEvents } = await renderEvents(3 * STEP);
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });
});
