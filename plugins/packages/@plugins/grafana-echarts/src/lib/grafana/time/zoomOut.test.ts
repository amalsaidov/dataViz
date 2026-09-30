import { zoomOutTimeRange } from './zoomOut';

describe('zoomOutTimeRange', () => {
  it('makes the range two times wider around its center, as core', () => {
    expect(zoomOutTimeRange({ from: 1000, to: 2000 })).toEqual({ from: 500, to: 2500 });
  });
});
