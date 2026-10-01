import { FieldType, toDataFrame } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent, height, width } from 'test/panel';

// Canvas baselines of stacked areas in two stack groups (core `custom.stacking.group`, #488). The fields
// `a` and `b` are in the group A, `c` and `d` are in the group B.

// 20 minutes between rows, so the rows fill the 3 h test time range.
const STEP = 20 * 60_000;
const values = { a: [5, 6, 7, 8, 7, 6], b: [5, 5, 5, 5, 5, 5], c: [2, 3, 2, 3, 2, 3], d: [4, 4, 4, 4, 4, 4] };

const renderEvents = async (stacking: StackingMode) => {
  const frame = toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: values.a.map((_, i) => 1783137094497 + i * STEP) },
      ...Object.entries(values).map(([name, fieldValues]) => ({
        name,
        type: FieldType.number,
        values: fieldValues,
        config: { custom: { stackGroup: name < 'c' ? 'A' : 'B' } },
      })),
    ],
  });
  const { container } = render(
    getComponent([frame], 'line', {
      zLevel: { series: SERIES_ZLEVEL },
      animation: { enabled: false },
      fillOpacity: 30,
      stacking,
    })
  );
  return getCanvasEvents(container);
};

describe('cartesian stacked areas in two stack groups', () => {
  it('stacks the areas of each group with the mode normal', async () => {
    const { defaultEvents, seriesEvents } = await renderEvents(StackingMode.Normal);
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('stacks the areas of each group with the mode percent', async () => {
    const { defaultEvents, seriesEvents } = await renderEvents(StackingMode.Percent);
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });
});
