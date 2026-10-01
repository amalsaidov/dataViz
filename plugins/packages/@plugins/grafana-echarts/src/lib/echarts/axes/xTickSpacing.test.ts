import { getXTickSpace, getXTickSpacing, X_TICK_SPACE_DEFAULT } from 'lib/echarts/axes/xTickSpacing';

describe('getXTickSpace', () => {
  it('adds the core gap of 18 px to the label width', () => {
    expect(getXTickSpace(60)).toBe(78);
  });

  it('uses the core default of 40 px when no label width is known', () => {
    expect(getXTickSpace(undefined)).toBe(X_TICK_SPACE_DEFAULT);
    expect(getXTickSpace(0)).toBe(X_TICK_SPACE_DEFAULT);
  });
});

describe('getXTickSpacing', () => {
  it('always hides labels that overlap', () => {
    expect(getXTickSpacing({ plotWidth: undefined, labelWidth: 30 })).toEqual({ axisLabel: { hideOverlap: true } });
  });

  it('fits one tick per label space in the plot width', () => {
    // 780 px / (60 + 18) px = 10 ticks.
    expect(getXTickSpacing({ plotWidth: 780, labelWidth: 60 })).toEqual({
      splitNumber: 10,
      axisLabel: { hideOverlap: true },
    });
  });

  it('gives fewer ticks to a narrower plot', () => {
    expect(getXTickSpacing({ plotWidth: 200, labelWidth: 60 }).splitNumber).toBe(2);
  });

  it('keeps at least one tick', () => {
    expect(getXTickSpacing({ plotWidth: 20, labelWidth: 60 }).splitNumber).toBe(1);
  });

  it('gives fewer ticks to wider labels', () => {
    expect(getXTickSpacing({ plotWidth: 780, labelWidth: 112 }).splitNumber).toBe(6);
  });
});
