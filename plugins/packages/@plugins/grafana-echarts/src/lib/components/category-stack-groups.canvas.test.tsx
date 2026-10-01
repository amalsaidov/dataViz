import { FieldType, toDataFrame } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent, height, width } from 'test/panel';

// Canvas baseline of stacked bars on a category axis in two stack groups (`custom.stackGroup`, #488).
// The fields `a` and `b` are in the group A, `c` and `d` are in the group B.

const values = { a: [5, 6, 7], b: [5, 5, 5], c: [2, 3, 2], d: [4, 4, 4] };

describe('cartesian stacked category bars in two stack groups', () => {
  it('stacks the bars of each group apart', async () => {
    const frame = toDataFrame({
      fields: [
        { name: 'category', type: FieldType.string, values: ['x', 'y', 'z'] },
        ...Object.entries(values).map(([name, fieldValues]) => ({
          name,
          type: FieldType.number,
          values: fieldValues,
          config: { custom: { stackGroup: name < 'c' ? 'A' : 'B' } },
        })),
      ],
    });
    const { container } = render(
      getComponent([frame], 'bar', {
        zLevel: { series: SERIES_ZLEVEL },
        animation: { enabled: false },
        stacking: StackingMode.Normal,
      })
    );
    const { defaultEvents, seriesEvents } = await getCanvasEvents(container);
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });
});
