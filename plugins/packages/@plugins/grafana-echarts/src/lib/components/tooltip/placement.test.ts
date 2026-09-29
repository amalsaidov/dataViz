import { anchorTransform } from './placement';

// jsdom has a 1024 x 768 window; the edge math takes 16 px off each for a scrollbar.
const size = { width: 200, height: 100 };

describe('anchorTransform', () => {
  it('centers the tooltip under the anchor, as floating-ui `bottom`', () => {
    expect(anchorTransform({ x: 300, y: 400, width: 10, height: 5 }, size)).toBe('translateX(205px) translateY(405px)');
  });

  it('shifts the tooltip on x to stay in the viewport', () => {
    expect(anchorTransform({ x: 20, y: 400, width: 10, height: 5 }, size)).toBe('translateX(0px) translateY(405px)');
    expect(anchorTransform({ x: 1000, y: 400, width: 10, height: 5 }, size)).toBe(
      'translateX(808px) translateY(405px)'
    );
  });

  it('flips the tooltip above the anchor when it does not fit under it', () => {
    expect(anchorTransform({ x: 300, y: 700, width: 10, height: 5 }, size)).toBe('translateX(205px) translateY(600px)');
  });
});
