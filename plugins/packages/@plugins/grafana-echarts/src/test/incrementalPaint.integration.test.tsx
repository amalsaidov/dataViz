import { FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { AXIS_ZLEVEL, SERIES_ZLEVEL } from 'test/canvas';
import { cellRects } from 'test/heatmapCanvas';
import { getAxisCanvasEvents, getComponent } from 'test/panel';

// Issue #51. zrender paints an incremental layer in slices of 15 ms and paints the remaining
// elements on the next animation frame. The cells of a matrix heatmap are on such a layer.
// On a slow CI runner that frame ran after the test disposed the chart, and threw
// `Cannot read properties of null (reading 'layerStack')`. jest-setup.js stops the clock that
// zrender reads for the slices. These tests move the wall clock 20 ms forward on each read.
// Without that setup, each cell then ends its slice.
// https://github.com/ecomfe/zrender/blob/master/src/canvas/Painter.ts (_paintPerCursorInRect)

// The frame of the "heatmap (matrix)" case in axis.canvas.test.tsx: 3 rows x 2 columns.
const matrixFrame = toDataFrame({
  fields: [
    { name: 'row', type: FieldType.string, values: ['a', 'b', 'c'] },
    { name: 'c1', type: FieldType.number, values: [1, 5, 9] },
    { name: 'c2', type: FieldType.number, values: [3, 7, 2] },
  ],
});

const matrixPanel = () =>
  getComponent([matrixFrame], 'heatmap', {
    zLevel: { series: SERIES_ZLEVEL, axis: AXIS_ZLEVEL },
    animation: { enabled: false },
    heatmapLayout: 'matrix',
  });

/** Render the panel with a wall clock that moves 20 ms forward on each `Date.now()`. */
const renderWithSlowClock = () => {
  let now = Date.now();
  jest.spyOn(Date, 'now').mockImplementation(() => (now += 20));
  return render(matrixPanel());
};

const nextAnimationFrame = () => new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

describe('incremental layer paint in jsdom', () => {
  afterEach(() => jest.restoreAllMocks());

  it('paints every matrix heatmap cell in one flush when the wall clock is slow', async () => {
    const reference = cellRects((await getAxisCanvasEvents(render(matrixPanel()).container)).seriesEvents);
    const slow = cellRects((await getAxisCanvasEvents(renderWithSlowClock().container)).seriesEvents);

    expect(reference).toHaveLength(6);
    expect(slow).toEqual(reference);
  });

  it('leaves no paint for an animation frame after the chart is disposed', async () => {
    // An error in an animation frame callback goes to `window`, not to the test.
    const errors: unknown[] = [];
    const onError = (event: ErrorEvent) => {
      errors.push(event.error);
      event.preventDefault();
    };
    window.addEventListener('error', onError);

    const { container, unmount } = renderWithSlowClock();
    await getAxisCanvasEvents(container);
    unmount();
    for (let frame = 0; frame < 5; frame++) {
      await nextAnimationFrame();
    }

    window.removeEventListener('error', onError);
    expect(errors).toEqual([]);
  });
});
