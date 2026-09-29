import { type DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent } from 'test/panel';

// "Connect null values" (`custom.spanNulls`, see `lib/echarts/converters/spanNulls.ts`) as drawn
// primitives. A null that breaks the line starts a new subpath (`moveTo`), so the count of
// `moveTo` calls on the series layer is the count of line pieces. No baselines: the claim is the
// count, and the pictures are in `span-nulls.canvas.test.tsx`.

// 15 minutes between rows, so the rows fill the 3 h test time range.
const STEP = 15 * 60_000;
const START = 1783137094497;

/** One time frame, `step` ms between the rows, with the given value fields. */
const frame = (
  fields: Array<{ name: string; values: Array<number | null>; spanNulls?: boolean | number }>,
  step = STEP
) =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: fields[0].values.map((_, i) => START + i * step) },
      ...fields.map(({ name, values, spanNulls }) => ({
        name,
        type: FieldType.number,
        values,
        config: { displayName: name, ...(spanNulls == null ? {} : { custom: { spanNulls } }) },
      })),
    ],
  });

const renderSeries = async (frames: DataFrame[], options = {}) => {
  const { container, unmount } = render(
    getComponent(frames, 'line', {
      zLevel: { series: SERIES_ZLEVEL },
      animation: { enabled: false },
      ...options,
    })
  );
  const { seriesEvents } = await getCanvasEvents(container);
  unmount();
  return seriesEvents;
};

const count = (events: Array<{ type: string }>, type: string) => events.filter((event) => event.type === type).length;

/**
 * The line pieces of a render. Each path (`beginPath` to its next `beginPath`) with a `lineTo` is a
 * line or an area; each `moveTo` in it starts one piece. The point markers are paths with an `arc`
 * and no `lineTo`, so they do not count.
 */
const pieces = (events: Array<{ type: string }>) => {
  let total = 0;
  let path: string[] = [];
  const close = () => {
    if (path.includes('lineTo')) {
      total += path.filter((type) => type === 'moveTo').length;
    }
    path = [];
  };
  for (const { type } of events) {
    if (type === 'beginPath') {
      close();
    }
    path.push(type);
  }
  close();
  return total;
};

// Leading, internal (1 row and 3 rows) and trailing null runs.
const WITH_NULLS = [null, 1, 3, null, 2, 4, null, null, null, 3, 1, null];

describe('Connect null values: drawn line pieces', () => {
  it('breaks the line at each internal null run when `false`', async () => {
    const events = await renderSeries([frame([{ name: 'cpu', values: WITH_NULLS, spanNulls: false }])]);
    expect(pieces(events)).toBe(3);
  });

  it('draws one piece over each null when `true`', async () => {
    const events = await renderSeries([frame([{ name: 'cpu', values: WITH_NULLS, spanNulls: true }])]);
    expect(pieces(events)).toBe(1);
  });

  it('connects only the runs shorter than a threshold', async () => {
    // The 1-row run is 2 steps wide, the 3-row run is 4 steps wide.
    const events = await renderSeries([frame([{ name: 'cpu', values: WITH_NULLS, spanNulls: 3 * STEP }])]);
    expect(pieces(events)).toBe(2);
  });

  it('connects an area series (a line with a fill) the same way', async () => {
    const broken = await renderSeries([frame([{ name: 'cpu', values: WITH_NULLS, spanNulls: false }])], {
      fillOpacity: 30,
    });
    const connected = await renderSeries([frame([{ name: 'cpu', values: WITH_NULLS, spanNulls: true }])], {
      fillOpacity: 30,
    });
    // Each piece has a stroke path and a fill path.
    expect(pieces(broken)).toBe(6);
    expect(pieces(connected)).toBe(2);
  });

  it('applies a field override to one series only', async () => {
    const both = await renderSeries([
      frame([
        { name: 'a', values: WITH_NULLS, spanNulls: true },
        { name: 'b', values: WITH_NULLS },
      ]),
    ]);
    // One piece for `a`, three for `b`.
    expect(pieces(both)).toBe(4);
  });

  it('keeps the gap under LTTB downsampling when `false`, and closes it when `true`', async () => {
    // Far more points than the plot has pixels, so ECharts samples the line (see
    // `lib/echarts/performance/constants.ts`). One long null run in the middle.
    const values = Array.from({ length: 4000 }, (_, i) => (i >= 1900 && i < 2100 ? null : Math.sin(i / 50)));
    const broken = await renderSeries([frame([{ name: 'cpu', values, spanNulls: false }], 2000)], {
      performance: { downsampling: true },
    });
    const connected = await renderSeries([frame([{ name: 'cpu', values, spanNulls: true }], 2000)], {
      performance: { downsampling: true },
    });
    expect(count(broken, 'lineTo')).toBeLessThan(values.length / 2); // it did sample
    expect(pieces(broken)).toBe(2);
    expect(pieces(connected)).toBe(1);
  });
});
