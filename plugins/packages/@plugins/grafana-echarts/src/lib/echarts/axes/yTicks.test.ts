import {
  getCoreYAxisTicks,
  getCoreYRange,
  getCoreYTickIncrement,
  getSeriesExtents,
  getYTickDecimals,
  getYTickSpace,
} from 'lib/echarts/axes/yTicks';

// The expected values follow `uPlot.rangeNum` and `findIncr` (uPlot 1.6) with the core config.
describe('getCoreYRange', () => {
  it('pads the data by 10% and rounds to a tenth of the magnitude', () => {
    expect(getCoreYRange({ dataMin: 1, dataMax: 4 })).toEqual([0.7, 4.3]);
    expect(getCoreYRange({ dataMin: 5, dataMax: 25 })).toEqual([3, 27]);
  });

  it('stops the pad at 0 for positive data', () => {
    expect(getCoreYRange({ dataMin: 0.2, dataMax: 10 })).toEqual([0, 11]);
  });

  it('extends the range to a soft limit', () => {
    expect(getCoreYRange({ dataMin: 1, dataMax: 4, softMax: 10 })).toEqual([0.7, 10]);
    expect(getCoreYRange({ dataMin: 5, dataMax: 25, softMin: 0 })).toEqual([0, 27]);
  });

  it('pins the hard limits', () => {
    expect(getCoreYRange({ dataMin: 1, dataMax: 4, hardMin: 0, hardMax: 5 })).toEqual([0, 5]);
  });

  it('opens a flat line from 0', () => {
    expect(getCoreYRange({ dataMin: 5, dataMax: 5 })).toEqual([0, 10]);
  });

  it('rounds the range to integers with 0 decimals', () => {
    expect(getCoreYRange({ dataMin: 1, dataMax: 4, decimals: 0 })).toEqual([0, 5]);
  });
});

describe('getCoreYTickIncrement', () => {
  it('uses the tick space of the axis length', () => {
    expect(getYTickSpace(300)).toBe(30);
    expect(getYTickSpace(150)).toBe(15);
  });

  it('selects the smallest step of 1, 2, 2.5 or 5 that keeps the tick space', () => {
    expect(getCoreYTickIncrement(0.7, 4.3, 300)).toBe(0.5);
    expect(getCoreYTickIncrement(0.7, 4.3, 120)).toBe(0.5);
    expect(getCoreYTickIncrement(0.7, 4.3, 600)).toBe(0.2);
    expect(getCoreYTickIncrement(3, 27, 300)).toBe(2.5);
  });

  it('has no step for an empty range or axis', () => {
    expect(getCoreYTickIncrement(1, 1, 300)).toBeUndefined();
    expect(getCoreYTickIncrement(0, 1, 0)).toBeUndefined();
  });

  it('gives the decimals of the step', () => {
    expect(getYTickDecimals(0.5)).toBe(1);
    expect(getYTickDecimals(0.25)).toBe(2);
    expect(getYTickDecimals(5)).toBeUndefined();
  });
});

describe('getCoreYAxisTicks', () => {
  it('gives the range and the multiples of the step in it', () => {
    expect(getCoreYAxisTicks({ dataMin: 1, dataMax: 4 }, 300)).toEqual({
      min: 0.7,
      max: 4.3,
      ticks: [1, 1.5, 2, 2.5, 3, 3.5, 4],
      decimals: 1,
    });
    expect(getCoreYAxisTicks({ dataMin: 100, dataMax: 120 }, 120).ticks).toEqual([100, 105, 110, 115, 120]);
  });

  it('has no ticks without a step', () => {
    expect(getCoreYAxisTicks({ dataMin: 1, dataMax: 4 }, 0)).toEqual({ min: 0.7, max: 4.3 });
  });
});

describe('getSeriesExtents', () => {
  it('reads the values of the data items', () => {
    expect(getSeriesExtents([{ data: [[0, 2], { value: [1, -1] }, [2, null]] }, { data: [] }])).toEqual([
      [-1, 2],
      undefined,
    ]);
  });

  it('adds the values of a stack at each x, positive and negative apart', () => {
    const extents = getSeriesExtents([
      {
        stack: 'a',
        data: [
          [0, 2],
          [1, -1],
        ],
      },
      {
        stack: 'a',
        data: [
          [0, 3],
          [1, -4],
        ],
      },
      { data: [[0, 1]] },
    ]);
    expect(extents).toEqual([
      [-1, 2],
      [-5, 5],
      [1, 1],
    ]);
  });
});
