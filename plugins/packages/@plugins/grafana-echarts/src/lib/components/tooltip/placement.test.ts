import { TOOLTIP_OFFSET } from './constants';
import { anchorTransform, cursorTransform } from './placement';

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

describe('cursorTransform', () => {
  const { x: ox, y: oy } = TOOLTIP_OFFSET;

  it('puts the box below and right of the cursor when it fits', () => {
    expect(cursorTransform({ x: 100, y: 100 }, size)).toBe(`translateX(${100 + ox}px) translateY(${100 + oy}px)`);
  });

  it('flips the box above and left of the cursor when only that side fits', () => {
    expect(cursorTransform({ x: 900, y: 700 }, size)).toBe(
      `translateX(${900 - ox}px) translateX(-100%) translateY(${700 - oy}px) translateY(-100%)`
    );
  });

  it('moves the box into the viewport when neither side of the cursor fits', () => {
    const tall = { width: 200, height: 600 };
    // 752 - 600: the box ends at the bottom of the viewport.
    expect(cursorTransform({ x: 100, y: 400 }, tall)).toBe(`translateX(${100 + ox}px) translateY(152px)`);
    const huge = { width: 2000, height: 2000 };
    expect(cursorTransform({ x: 100, y: 400 }, huge)).toBe('translateX(0px) translateY(0px)');
  });
});
