import { type EChartsType } from 'lib/echarts/echarts';
import { draftFromRange, isAnnotationGesture, timeAtPixel } from 'lib/echarts/annotationGestures';

describe('isAnnotationGesture', () => {
  it.each([
    [{ ctrlKey: true, metaKey: false }, true],
    [{ ctrlKey: false, metaKey: true }, true],
    [{ ctrlKey: false, metaKey: false }, false],
    [undefined, false],
  ])('%p is %p', (event, expected) => {
    expect(isAnnotationGesture(event)).toBe(expected);
  });
});

/** A chart whose first grid spans x 50..350, and whose x-axis maps a pixel to `pixel * 10`. */
const fakeChart = ({ disposed = false, value = (x: number): unknown => x * 10 } = {}) =>
  ({
    isDisposed: () => disposed,
    containPixel: (_finder: unknown, [x]: [number, number]) => x >= 50 && x <= 350,
    convertFromPixel: (_finder: unknown, x: number) => value(x),
  }) as unknown as EChartsType;

describe('timeAtPixel', () => {
  it('gives the x-axis value at a pixel in the grid', () => {
    expect(timeAtPixel(fakeChart(), 100, 20)).toBe(1000);
  });

  it('gives null out of the grid', () => {
    expect(timeAtPixel(fakeChart(), 10, 20)).toBeNull();
  });

  it('gives null for a disposed chart', () => {
    expect(timeAtPixel(fakeChart({ disposed: true }), 100, 20)).toBeNull();
  });

  it('gives null when the axis gives no finite number', () => {
    expect(timeAtPixel(fakeChart({ value: () => NaN }), 100, 20)).toBeNull();
    expect(timeAtPixel(fakeChart({ value: () => 'a' }), 100, 20)).toBeNull();
  });
});

describe('draftFromRange', () => {
  it('orders the two times', () => {
    expect(draftFromRange(300, 100)).toEqual({ from: 100, to: 300 });
    expect(draftFromRange(100, 300)).toEqual({ from: 100, to: 300 });
  });
});
