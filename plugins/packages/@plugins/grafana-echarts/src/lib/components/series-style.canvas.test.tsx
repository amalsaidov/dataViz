import { FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent, height, width } from 'test/panel';

// Canvas baseline of the per-field series style (#534): `a` has Line width 4 and Fill opacity 30, `b` has
// Point size 12 and Show points Always. The values are the values of the import fixture set
// `timeseries-panel-level-overrides`. The claims are in `series-style.integration.test.tsx`.

const START = 1783137094497;
const times = [0, 1, 2, 3].map((i) => START + i * 30 * 60_000);

describe('cartesian per-field series style', () => {
  it('draws each series with the style of its field', async () => {
    const frame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: times },
        {
          name: 'a',
          type: FieldType.number,
          values: [1, 3, 2, 4],
          config: { custom: { lineWidth: 4, fillOpacity: 30 } },
        },
        {
          name: 'b',
          type: FieldType.number,
          values: [2, 1, 4, 3],
          config: { custom: { pointSize: 12, showPoints: 'always' } },
        },
      ],
    });
    const { container } = render(
      getComponent([frame], 'line', {
        lineWidth: 1,
        fillOpacity: 0,
        pointSize: 5,
        performance: { showPoints: 'never' },
        zLevel: { series: SERIES_ZLEVEL },
        animation: { enabled: false },
      })
    );
    const { defaultEvents, seriesEvents } = await getCanvasEvents(container);
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });
});
