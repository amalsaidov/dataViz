import { VisibilityMode } from '@grafana/schema';
import {
  barRects,
  barTexts,
  DENSE_ROWS,
  denseFrame,
  renderTimeline,
  shortStateFrame,
  singleLaneFrame,
  startEndFrame,
  stringsFrame,
} from 'test/timelineCanvas';

// State timeline core-parity claims, stated as counts and as differences between two
// renders. No baselines here: the drawn geometry is pinned next door in
// `timeline.canvas.test.tsx`. See `test/timelineCanvas.tsx` for the fixtures.

const bars = async (...args: Parameters<typeof renderTimeline>) =>
  barRects((await renderTimeline(...args)).seriesEvents);

describe('state timeline bars', () => {
  it('draws more bars with mergeValues off than on', async () => {
    const merged = await bars([stringsFrame()], { mergeValues: true });
    const unmerged = await bars([stringsFrame()], { mergeValues: false });
    // Two lanes of nine rows, less one null: 17 rows, and fewer merged states.
    expect(unmerged).toHaveLength(17);
    expect(merged.length).toBeLessThan(unmerged.length);
  });

  it('draws a gap for a null', async () => {
    const [laneA, laneB] = [0, 1].map(async (lane) => {
      const rects = await bars([stringsFrame()], { mergeValues: false });
      const tops = [...new Set(rects.map((rect) => rect.y))].sort((a, b) => a - b);
      return rects.filter((rect) => rect.y === tops[lane]);
    });
    // Lane B has one null row, so one bar less than lane A, and the bars do not touch there.
    expect((await laneA).length - (await laneB).length).toBe(1);
    const b = await laneB;
    const gaps = b.slice(1).filter((rect, i) => rect.x > b[i].x + b[i].width);
    expect(gaps).toHaveLength(1);
  });

  it('draws shorter bars with a lower rowHeight', async () => {
    const tall = await bars([stringsFrame()], { rowHeight: 0.9 });
    const short = await bars([stringsFrame()], { rowHeight: 0.5 });
    expect(short[0].height).toBeLessThan(tall[0].height);
    expect(short[0].height / tall[0].height).toBeCloseTo(0.5 / 0.9, 1);
  });

  it('fills the full height with a single lane, whatever the rowHeight', async () => {
    const one = await bars([singleLaneFrame()], { rowHeight: 0.5 });
    const two = await bars([stringsFrame()], { rowHeight: 1 });
    const top = Math.min(...two.map((rect) => rect.y));
    const bottom = Math.max(...two.map((rect) => rect.y + rect.height));
    expect(one[0].y).toBe(top);
    expect(one[0].y + one[0].height).toBe(bottom);
  });

  it('runs the last state of a lane to the end of the time range', async () => {
    const rects = await bars([startEndFrame()]);
    const one = await bars([singleLaneFrame()]);
    // The Gantt shape ends at its end time; a plain frame ends at the right grid edge.
    const right = (list: typeof rects) => Math.max(...list.map((rect) => rect.x + rect.width));
    expect(right(rects)).toBeLessThan(right(one));
  });
});

describe('state timeline dense lanes', () => {
  it('draws at most one 1 px bar per pixel column', async () => {
    const thin = (await bars([denseFrame()])).filter((rect) => rect.width === 1);
    expect(thin.length).toBeGreaterThan(100);
    expect(new Set(thin.map((rect) => rect.x)).size).toBe(thin.length);
  });

  it('draws fewer bars than states, with no gap in the lane', async () => {
    const rects = await bars([denseFrame()]);
    expect(rects.length).toBeLessThan(DENSE_ROWS / 2);
    const sorted = [...rects].sort((a, b) => a.x - b.x);
    const gaps = sorted.slice(1).filter((rect, i) => rect.x > sorted[i].x + sorted[i].width);
    expect(gaps).toHaveLength(0);
  });
});

describe('state timeline value text', () => {
  it('draws no text with showValue never', async () => {
    const { seriesEvents } = await renderTimeline([stringsFrame()], { showValue: VisibilityMode.Never });
    expect(barTexts(seriesEvents)).toEqual([]);
  });

  it('draws text on a one-character bar with showValue always, but not auto', async () => {
    const auto = barTexts((await renderTimeline([shortStateFrame()], { showValue: VisibilityMode.Auto })).seriesEvents);
    const always = barTexts(
      (await renderTimeline([shortStateFrame()], { showValue: VisibilityMode.Always })).seriesEvents
    );
    expect(auto).toEqual(['OK', 'OK']);
    expect(always).toEqual(['OK', 'E', 'OK']);
  });

  it('cuts text to the bar width without an ellipsis', async () => {
    const texts = barTexts((await renderTimeline([stringsFrame()])).seriesEvents);
    expect(texts).toContain('ERR');
    expect(texts.some((text) => text.includes('…') || text.includes('...'))).toBe(false);
  });
});
