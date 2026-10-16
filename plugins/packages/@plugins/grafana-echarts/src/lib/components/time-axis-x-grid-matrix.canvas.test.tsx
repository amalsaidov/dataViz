import { render } from '@testing-library/react';
import { normalizeCanvasEvents } from 'test/canvas';
import { getCanvasEvents, getComponent, height, width } from 'test/panel';

import { gridRenderOptions } from './timeAxisGridRangesFixture';
import { BAR_POSITIONS, DST_RANGES, MATRIX_RANGES, matrixFrame, matrixRange } from './xGridMatrixFixture';

// Canvas baselines of a part of the x grid matrix (#1087): bars at both plot edges in America/New_York.
// The claims are in `time-axis-x-grid-matrix.integration.test.tsx`.
const RANGES = {
  '6h': matrixRange(MATRIX_RANGES['6h']),
  '2d': matrixRange(MATRIX_RANGES['2d']),
  '30d': matrixRange(MATRIX_RANGES['30d']),
  '90d': matrixRange(MATRIX_RANGES['90d']),
  'DST 10d': DST_RANGES['DST 10d'],
};

describe('the x grid matrix of bars at the plot edges', () => {
  it.each(Object.entries(RANGES))('on a range of %s in America/New_York', async (_, timeRange) => {
    const { container } = render(
      getComponent(
        [matrixFrame(timeRange, BAR_POSITIONS['both edges'])],
        'bar',
        gridRenderOptions,
        { timeRange },
        {
          timeRange,
          timeZone: 'America/New_York',
        }
      )
    );
    const { defaultEvents, seriesEvents } = await getCanvasEvents(container);
    expect(normalizeCanvasEvents(defaultEvents)).toMatchCanvasSnapshot(seriesEvents, { width, height });
  });
});
