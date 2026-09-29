import { buildHistogram, createTheme, type DataFrame, FieldType, toDataFrame } from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import { barRects, type DrawnRect, renderBars, texts } from 'test/barCanvas';
import { type PanelOptions } from 'types';

// The histogram mode of the cartesian panel against the buckets of the core Histogram panel. Core buckets
// the raw values with `buildHistogram` of `@grafana/data`, and draws each bucket from its lower to its upper
// bound on a linear x axis (`Histogram.tsx`, `prepConfig`). The expected bars come from `buildHistogram`, and
// the drawn bars come from a render. No baselines: `histogram.canvas.test.tsx` has them.
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/Histogram.tsx

const values = (name: string, data: number[], config = {}): DataFrame =>
  toDataFrame({
    fields: [
      { name: 'time', type: FieldType.time, values: data.map((_, i) => 1783137600000 + i * 60_000) },
      { name, type: FieldType.number, values: data, config },
    ],
  });

const heights = values('Height', [152, 158, 160, 161, 165, 168, 170, 171, 175, 180, 181, 199, 201]);

const renderHistogram = (frames: DataFrame[], options: Partial<PanelOptions> = {}) =>
  renderBars(frames, { histogram: true, ...options });

/** The drawn bars, from left to right, then from bottom to top. */
const sortedBars = (rects: DrawnRect[]) => [...rects].sort((a, b) => a.x - b.x || b.y - a.y);

describe('histogram mode against the core buckets', () => {
  it.each<[string, Partial<PanelOptions>]>([
    ['automatic buckets', {}],
    ['an explicit bucket size', { bucketSize: 10 }],
    ['a bucket count', { bucketCount: 5 }],
    ['a bucket offset', { bucketSize: 10, bucketOffset: 5 }],
  ])('draws one bar for each core bucket with a count, for %s', async (_, options) => {
    const core = buildHistogram([heights], options, createTheme());
    const counts = core!.counts[0].values.filter((count) => count > 0);
    const bars = sortedBars(barRects((await renderHistogram([heights], options)).series));
    expect(bars).toHaveLength(counts.length);

    // The px of one x unit, from the first bar. Each other bar starts at its own lower bound.
    const [first] = bars;
    const nonEmpty = core!.xMin.values.filter((_, i) => core!.counts[0].values[i] > 0);
    const size = core!.xMax.values[0] - core!.xMin.values[0];
    const pxPerUnit = first.width / size;
    bars.forEach((bar, i) => {
      expect(bar.x - first.x).toBeCloseTo((nonEmpty[i] - nonEmpty[0]) * pxPerUnit, 0);
      expect(bar.width).toBeCloseTo(first.width, 0);
    });

    // The height of each bar is in proportion to its count.
    const pxPerCount = first.height / counts[0];
    bars.forEach((bar, i) => expect(bar.height).toBeCloseTo(counts[i] * pxPerCount, 0));
  });

  it('keeps the gap of an empty bucket on the x axis', async () => {
    const bars = sortedBars(barRects((await renderHistogram([values('A', [1, 2, 35])], { bucketSize: 10 })).series));
    expect(bars).toHaveLength(2);
    // The second bar starts 3 buckets after the first.
    expect(bars[1].x - bars[0].x).toBeCloseTo(3 * bars[0].width, 0);
  });

  it('labels the x axis with the unit of the bucketed field', async () => {
    const frame = values('Latency', [120, 180, 250, 420], { unit: 'ms' });
    const { axis } = await renderHistogram([frame], { bucketSize: 100 });
    expect(texts(axis).some((text) => text.endsWith(' ms'))).toBe(true);
  });

  it('draws the series of two fields over each other with Stacking Off', async () => {
    const frames = [values('A', [1, 2, 11]), values('B', [3, 12, 13])];
    const bars = barRects((await renderHistogram(frames, { bucketSize: 10 })).series);
    // Two buckets, and both series have a bar in each. The bars of one bucket start at the same x.
    expect(bars).toHaveLength(4);
    expect(new Set(bars.map((bar) => Math.round(bar.x))).size).toBe(2);
    expect(new Set(bars.map((bar) => Math.round(bar.y + bar.height))).size).toBe(1);
  });

  it('puts each bar on the bar before it with Stacking Normal', async () => {
    const frames = [values('A', [1, 2, 11]), values('B', [3, 12, 13])];
    const bars = sortedBars(
      barRects((await renderHistogram(frames, { bucketSize: 10, stacking: StackingMode.Normal })).series)
    );
    expect(bars).toHaveLength(4);
    // In each bucket, the top of the lower bar is the bottom of the upper bar.
    for (const [lower, upper] of [bars.slice(0, 2), bars.slice(2, 4)]) {
      expect(upper.y + upper.height).toBeCloseTo(lower.y, 0);
    }
  });

  it('draws no bars for a field that the legend hides, and keeps its buckets', async () => {
    const frames = [values('A', [1, 2, 11]), values('B', [3, 31])];
    const hideB = {
      defaults: {},
      overrides: [
        {
          __systemRef: 'hideSeriesFrom',
          matcher: { id: 'byNames', options: { mode: 'exclude', names: ['A'], prefix: 'All except:', readOnly: true } },
          properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: false } }],
        },
      ],
    };
    const shown = barRects((await renderBars(frames, { histogram: true, bucketSize: 10 })).series);
    const hidden = barRects((await renderBars(frames, { histogram: true, bucketSize: 10 }, {}, hideB)).series);
    expect(shown).toHaveLength(4);
    expect(hidden).toHaveLength(2);
  });
});
