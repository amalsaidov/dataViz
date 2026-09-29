import { FieldType, toDataFrame } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent, height, width } from 'test/panel';

// Canvas baselines of stacked line and area series on a time axis, with nulls. The claims are in
// `stacked-lines.integration.test.tsx`.

// 20 minutes between rows, so the 10 rows fill the 3 h test time range.
const STEP = 20 * 60_000;
const a = [10, 30, null, 20, 40, null, null, null, 30, 10];
// `b` is null where `a` is null, and at row 8, where `a` has a value: there `b` adds 0.
const b = [5, 10, null, 10, 10, null, null, null, null, 5];

const renderEvents = async (spanNulls: boolean | number, options = {}) => {
  const frame = toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: a.map((_, i) => 1783137094497 + i * STEP) },
      { name: 'a', type: FieldType.number, values: a, config: { custom: { spanNulls } } },
      { name: 'b', type: FieldType.number, values: b, config: { custom: { spanNulls } } },
    ],
  });
  const { container } = render(
    getComponent([frame], 'line', {
      zLevel: { series: SERIES_ZLEVEL },
      animation: { enabled: false },
      stacking: StackingMode.Normal,
      ...options,
    })
  );
  return getCanvasEvents(container);
};

describe('cartesian stacked lines with null values', () => {
  it('stacks two lines with Connect null values Never', async () => {
    const { defaultEvents, seriesEvents } = await renderEvents(false);
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('stacks two areas with a 60 min threshold', async () => {
    const { defaultEvents, seriesEvents } = await renderEvents(3 * STEP, { fillOpacity: 30 });
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });
});
