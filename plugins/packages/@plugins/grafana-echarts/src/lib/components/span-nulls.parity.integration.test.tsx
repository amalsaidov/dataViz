import { FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent } from 'test/panel';

// Parity of "Connect null values" (`custom.spanNulls`) with the core Time series panel. The expected
// line pieces come from the core rule, and the drawn pieces come from a render. No baselines, and no
// hard-coded counts: the same rule decides both. Fixed cases are in `span-nulls.integration.test.tsx`.

const STEP = 15 * 60_000;
const START = 1783137094497;

/**
 * Copy of the core rule, which is not exported at runtime. Nulls between two values become
 * `undefined` (connected) when the values are closer than `maxThreshold`.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/transformations/transformers/nulls/nullToUndefThreshold.ts
 */
function nullToUndefThreshold(refValues: number[], fieldValues: unknown[], maxThreshold: number) {
  let prevRef;
  let nullIdx;

  for (let i = 0; i < fieldValues.length; i++) {
    const fieldVal = fieldValues[i];

    if (fieldVal == null) {
      if (nullIdx == null && prevRef != null) {
        nullIdx = i;
      }
    } else {
      if (nullIdx != null && prevRef != null) {
        if (refValues[i] - prevRef < maxThreshold) {
          while (nullIdx < i) {
            fieldValues[nullIdx++] = undefined;
          }
        }
        nullIdx = null;
      }
      prevRef = refValues[i];
    }
  }

  return fieldValues;
}

/**
 * The points of each line piece that the core panel draws. Core applies the rule for a number, and
 * uPlot `spanGaps` connects over `undefined` but breaks at `null`
 * (https://github.com/leeoniya/uPlot/blob/master/docs/README.md#series). `true` connects all.
 */
function corePieces(times: number[], values: Array<number | null>, spanNulls: boolean | number): number[] {
  const processed = typeof spanNulls === 'number' ? nullToUndefThreshold(times, [...values], spanNulls) : [...values];
  const pieces: number[] = [];
  let open = false;
  for (const value of processed) {
    if (value === undefined) {
      continue;
    }
    if (value === null) {
      // `true` connects over a null, so the piece stays open.
      open = spanNulls === true && open;
    } else {
      if (!open) {
        pieces.push(0);
        open = true;
      }
      pieces[pieces.length - 1]++;
    }
  }
  return pieces;
}

/**
 * The points of each drawn line piece. A `moveTo` starts a piece and each `lineTo` adds a point. Only
 * paths with a `lineTo` count: the point markers are paths with an `arc` and no `lineTo`.
 */
function drawnPieces(events: Array<{ type: string }>): number[] {
  const pieces: number[] = [];
  let path: number[] = [];
  const close = () => {
    if (path.some((points) => points > 1)) {
      pieces.push(...path);
    }
    path = [];
  };
  for (const { type } of events) {
    if (type === 'beginPath') {
      close();
    } else if (type === 'moveTo') {
      path.push(1);
    } else if (type === 'lineTo' && path.length) {
      path[path.length - 1]++;
    }
  }
  close();
  return pieces;
}

const N = null;
// Leading, 1-row, 3-row, 2-row and trailing runs, and a series that starts with a value.
// A line of one value draws no path, so no case has only one.
const CASES: Record<string, Array<number | null>> = {
  'all kinds of runs': [N, 1, 3, N, 2, 4, N, N, N, 3, 1, N, N, 5, 2, N],
  'starts with a value': [1, 2, N, 3, N, N, 4, 5, N],
  'no nulls': [1, 2, 3, 4, 5, 6],
};

// A threshold below, at and above each run width: the 1-row run is 2 steps wide. The rule is strict,
// so a run that is exactly `threshold` wide is not connected.
const SPAN_NULLS: Array<[string, boolean | number]> = [
  ['false', false],
  ['true', true],
  ['1 step', STEP],
  ['2 steps', 2 * STEP],
  ['2 steps + 1 ms', 2 * STEP + 1],
  ['3 steps', 3 * STEP],
  ['4 steps', 4 * STEP],
  ['5 steps', 5 * STEP],
];

describe('Connect null values: parity with the core panel', () => {
  describe.each(Object.entries(CASES))('%s', (_, values) => {
    const times = values.map((_, i) => START + i * STEP);

    it.each(SPAN_NULLS)('draws the pieces of the core rule for %s', async (_, spanNulls) => {
      const frame = toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: times },
          { name: 'cpu', type: FieldType.number, values, config: { custom: { spanNulls } } },
        ],
      });
      const { container, unmount } = render(
        getComponent([frame], 'line', { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false } })
      );
      const { seriesEvents } = await getCanvasEvents(container);
      unmount();

      expect(drawnPieces(seriesEvents)).toEqual(corePieces(times, values, spanNulls));
    });
  });
});
