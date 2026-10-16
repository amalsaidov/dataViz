import { type DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import { render } from '@testing-library/react';
import { SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent } from 'test/panel';

// Stacked line and area series on a time axis, as drawn primitives. The null rules are those of core
// Time series (`lib/echarts/converters/stackedLines.ts`). No baselines: the claims are the line
// geometry, and the pictures are in `stacked-lines.canvas.test.tsx`.

const STEP = 15 * 60_000;
const START = 1783137094497;

type Values = Array<number | null>;

/** One time frame, `STEP` ms between the rows, with the given value fields. */
const frame = (fields: Array<{ name: string; values: Values; spanNulls?: boolean | number }>, start = START) =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: fields[0].values.map((_, i) => start + i * STEP) },
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
    getComponent(frames, 'line', { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false }, ...options })
  );
  const { seriesEvents } = await getCanvasEvents(container);
  unmount();
  return seriesEvents;
};

interface PathStep {
  type: string;
  props?: { x?: number; y?: number };
}

/** The pieces of each stroked line, as rounded `[x, y]` points. The point markers have no `lineTo`. */
const linePieces = (events: Array<{ type: string; props?: { path?: PathStep[] } }>) =>
  events
    .filter((event) => event.type === 'stroke')
    .map((event) => event.props?.path ?? [])
    .filter((path) => path.some(({ type }) => type === 'lineTo'))
    .flatMap((path) => {
      const pieces: number[][][] = [];
      for (const { type, props } of path) {
        if (type === 'moveTo') {
          pieces.push([]);
        }
        if ((type === 'moveTo' || type === 'lineTo') && props?.x != null && props.y != null) {
          pieces[pieces.length - 1]?.push([Math.round(props.x), Math.round(props.y)]);
        }
      }
      return pieces;
    });

const sum = (a: Values, b: Values) => a.map((value, i) => (value ?? 0) + (b[i] ?? 0));

const A = [10, 20, 15, 25, 20];
const B = [5, null, 8, 6, 9];

describe('stacked lines: drawn geometry', () => {
  it('draws the upper line of a stack on the sum, the same as an unstacked line of the sum', async () => {
    const stacked = await renderSeries(
      [
        frame([
          { name: 'a', values: A },
          { name: 'b', values: [5, 7, 8, 6, 9] },
        ]),
      ],
      {
        stacking: StackingMode.Normal,
      }
    );
    const summed = await renderSeries([
      frame([
        { name: 'a', values: A },
        { name: 'b', values: sum(A, [5, 7, 8, 6, 9]) },
      ]),
    ]);
    expect(linePieces(stacked)).toEqual(linePieces(summed));
  });

  it('draws a null in one line of a stack on the line below it, as core, and does not break it', async () => {
    const stacked = await renderSeries(
      [
        frame([
          { name: 'a', values: A },
          { name: 'b', values: B },
        ]),
      ],
      { stacking: StackingMode.Normal }
    );
    const summed = await renderSeries([
      frame([
        { name: 'a', values: A },
        { name: 'b', values: sum(A, B) },
      ]),
    ]);
    expect(linePieces(stacked)).toHaveLength(2);
    expect(linePieces(stacked)).toEqual(linePieces(summed));
  });

  // Row 2 and rows 5 to 7 are null in each line: a 2-step and a 4-step gap.
  const allNull = (spanNulls: boolean | number) =>
    frame([
      { name: 'a', values: [10, 12, null, 20, 22, null, null, null, 30, 32], spanNulls },
      { name: 'b', values: [5, 6, null, 6, 7, null, null, null, 7, 8], spanNulls },
    ]);

  it('breaks each line at a row where each line of the stack is null when `false`', async () => {
    const events = await renderSeries([allNull(false)], { stacking: StackingMode.Normal });
    expect(linePieces(events)).toHaveLength(6);
  });

  it('connects each line over the null rows when `true`', async () => {
    const events = await renderSeries([allNull(true)], { stacking: StackingMode.Normal });
    expect(linePieces(events)).toHaveLength(2);
  });

  it('connects only the gaps shorter than a numeric threshold', async () => {
    const events = await renderSeries([allNull(3 * STEP)], { stacking: StackingMode.Normal });
    expect(linePieces(events)).toHaveLength(4);
  });

  it('connects a line with a threshold where the line below it breaks, as core (#440)', async () => {
    // Row 2 is null in each line. `a` breaks there; `b` connects under its threshold.
    const a = [10, 12, null, 20, 22];
    const b = [5, 6, null, 6, 7];
    const stacked = await renderSeries(
      [
        frame([
          { name: 'a', values: a, spanNulls: false },
          { name: 'b', values: b, spanNulls: 3 * STEP },
        ]),
      ],
      { stacking: StackingMode.Normal }
    );
    const summed = await renderSeries([
      frame([
        { name: 'a', values: a, spanNulls: false },
        { name: 'b', values: sum(a, b).map((value, i) => (a[i] == null ? null : value)), spanNulls: 3 * STEP },
      ]),
    ]);
    const [a1, a2, top] = linePieces(stacked);
    // `a` draws 2 pieces and `b` draws 1.
    expect(linePieces(stacked)).toHaveLength(3);
    expect([a1, a2]).toEqual(linePieces(summed).slice(0, 2));
    // `b` draws the line of the sum, with one more point on its segment at row 2.
    const summedTop = linePieces(summed)[2];
    expect(top.filter((_, i) => i !== 2)).toEqual(summedTop);
    const [[x0, y0], [x1, y1]] = [summedTop[1], summedTop[2]];
    const [x, y] = top[2];
    expect(Math.abs(y - (y0 + ((y1 - y0) * (x - x0)) / (x1 - x0)))).toBeLessThanOrEqual(1);
  });

  it('stacks the lines of two frames with unequal timestamps without a gap', async () => {
    // B starts one step after A and ends one step after A.
    const a = frame([{ name: 'a', values: [10, 20, 15, 25] }]);
    const b = frame([{ name: 'b', values: [5, 8, 6, 9] }], START + STEP);
    const events = await renderSeries([a, b], { stacking: StackingMode.Normal });
    // One piece for each line: the join rows that a frame does not have add 0.
    expect(linePieces(events)).toHaveLength(2);
  });

  it('stacks an area (a line with a fill) the same way as a line', async () => {
    const options = { stacking: StackingMode.Normal, fillOpacity: 30 };
    const line = await renderSeries([allNull(false)], { stacking: StackingMode.Normal });
    const area = await renderSeries([allNull(false)], options);
    expect(linePieces(area)).toEqual(linePieces(line));
  });
});
