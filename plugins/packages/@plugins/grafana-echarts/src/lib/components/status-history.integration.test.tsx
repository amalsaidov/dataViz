import {
  type BarRect,
  barRects,
  barTexts,
  renderStatusHistory,
  statusGridFrame,
  stringsFrame,
} from 'test/timelineCanvas';

// Status history core-parity claims, stated as counts and as differences between two
// renders. No baselines here: the drawn geometry is pinned next door in
// `status-history.canvas.test.tsx`. See `test/timelineCanvas.tsx` for the fixtures.

const render = async (...args: Parameters<typeof renderStatusHistory>) =>
  (await renderStatusHistory(...args)).seriesEvents;
const cells = async (...args: Parameters<typeof renderStatusHistory>) => barRects(await render(...args));
const centre = (rect: BarRect) => rect.x + rect.width / 2;

describe('status history cells', () => {
  it('draws one cell per sample and never merges, even with mergeValues on', async () => {
    // Two lanes of nine rows, less one null: 17 samples. The state timeline merges them into fewer bars.
    expect(await cells([stringsFrame()], { mergeValues: true })).toHaveLength(17);
  });

  it('draws narrower cells with a lower colWidth, on the same centres', async () => {
    const wide = await cells([statusGridFrame()], { colWidth: 0.9 });
    const narrow = await cells([statusGridFrame()], { colWidth: 0.5 });
    expect(narrow).toHaveLength(wide.length);
    narrow.forEach((rect, i) => {
      expect(rect.width).toBeLessThan(wide[i].width);
      expect(Math.abs(centre(rect) - centre(wide[i]))).toBeLessThanOrEqual(1);
    });
  });

  it('draws every cell at the same width: the half-interval axis padding keeps the edge cells whole', async () => {
    const widths = new Set((await cells([statusGridFrame()])).map((rect) => rect.width));
    expect(widths.size).toBe(1);
  });

  it('centres the value text on each cell', async () => {
    const events = await render([statusGridFrame()], { colWidth: 0.9 });
    const texts = events.filter((event) => event.type === 'fillText');
    const rects = barRects(events);
    expect(texts.length).toBeGreaterThan(0);
    for (const text of texts) {
      // zrender draws text at 0,0 and moves it with the canvas transform.
      const x = Number((text as { transform?: number[] }).transform?.[4]);
      expect(rects.some((rect) => Math.abs(centre(rect) - x) <= 1)).toBe(true);
    }
  });

  it('draws the value text of each sample, not merged step labels', async () => {
    expect(barTexts(await render([statusGridFrame()]))).toContain('65');
  });
});
