import {
  buildHistogram,
  createTheme,
  type DataFrame,
  DataFrameType,
  FieldType,
  getHistogramFields,
  toDataFrame,
} from '@grafana/data';
import { StackingMode } from '@grafana/schema';
import { type BarCanvasEvent, barRects, type DrawnRect, drawnTexts, renderBars, texts } from 'test/barCanvas';
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

  // Core uses the automatic size for a negative size (`if (!bucketSize || bucketSize < 0)` in `buildHistogram`).
  // The panel also uses the automatic buckets for a negative count and for a value that is not finite.
  // https://github.com/grafana/grafana/blob/main/packages/grafana-data/src/transformations/transformers/histogram.ts
  it.each<[string, Partial<PanelOptions>]>([
    ['a negative bucket size', { bucketSize: -1 }],
    ['a negative bucket count', { bucketCount: -1 }],
    ['a negative size and count', { bucketSize: -1, bucketCount: -1 }],
    ['a bucket offset that is not finite', { bucketSize: Infinity, bucketOffset: Number.NaN }],
  ])('draws the same bars as the automatic buckets for %s', async (_, options) => {
    const automatic = sortedBars(barRects((await renderHistogram([heights])).series));
    const bars = sortedBars(barRects((await renderHistogram([heights], options)).series));
    expect(bars.length).toBeGreaterThan(0);
    expect(bars).toEqual(automatic);
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

// Core draws the buckets of a heatmap-rows frame, which have names, on an ordinal x axis (`isOrdinalX` in
// `prepConfig`). Bucket `i` is one position wide and starts at position `i`. The axis ends at the last
// position, the lower bound of the empty `+Inf` bucket. Each position has a tick with the name of its lower bound.
// https://github.com/grafana/grafana/blob/main/public/app/plugins/panel/histogram/Histogram.tsx
describe('histogram mode against the core ordinal buckets', () => {
  const leFrame = toDataFrame({
    meta: { type: DataFrameType.HeatmapRows },
    fields: [
      { name: 'time', type: FieldType.time, values: [1783137600000, 1783137660000, 1783137720000] },
      { name: '0.005', type: FieldType.number, values: [2, 3, 1] },
      { name: '0.01', type: FieldType.number, values: [5, 4, 6] },
      { name: '0.1', type: FieldType.number, values: [9, 12, 10] },
      { name: '1', type: FieldType.number, values: [3, 2, 4] },
      { name: '+Inf', type: FieldType.number, values: [1, 0, 1] },
    ],
  });
  const core = getHistogramFields(leFrame)!;

  /** The labels of the x axis, from left to right: the texts on the lowest line of the axis layer. */
  const xLabels = (axis: BarCanvasEvent[]) => {
    const drawn = drawnTexts(axis);
    const bottom = Math.max(...drawn.map(({ y }) => y));
    return drawn.filter(({ y }) => y === bottom).sort((a, b) => a.x - b.x);
  };

  it('draws one bar of the same width for each core bucket, side by side, with the core counts', async () => {
    const counts = core.counts[0].values.filter((count) => count > 0);
    const bars = sortedBars(barRects((await renderHistogram([leFrame])).series));
    expect(bars).toHaveLength(counts.length);
    const [first] = bars;
    const pxPerCount = first.height / counts[0];
    bars.forEach((bar, i) => {
      expect(bar.width).toBeCloseTo(first.width, 0);
      expect(bar.x).toBeCloseTo(first.x + i * first.width, 0);
      expect(bar.height).toBeCloseTo(counts[i] * pxPerCount, 0);
    });
  });

  it('labels the positions of the x axis with the core bucket names, in order', async () => {
    const { axis } = await renderHistogram([leFrame]);
    expect(xLabels(axis).map(({ text }) => text)).toEqual(core.xMin.values);
  });

  it('puts the tick of the name of a lower bound at the left edge of its bar', async () => {
    const { series, axis } = await renderHistogram([leFrame]);
    const bars = sortedBars(barRects(series));
    const labels = xLabels(axis);
    expect(labels.length).toBeGreaterThan(bars.length);
    bars.forEach((bar, i) => expect(labels[i].x).toBeCloseTo(bar.x, 0));
    // The last tick is the right edge of the last bar.
    const last = bars[bars.length - 1];
    expect(labels[bars.length].x).toBeCloseTo(last.x + last.width, 0);
  });
});
