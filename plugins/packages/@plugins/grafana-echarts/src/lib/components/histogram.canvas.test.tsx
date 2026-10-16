import { type DataFrame, DataFrameType, FieldType, toDataFrame } from '@grafana/data';
import { GraphGradientMode, StackingMode } from '@grafana/schema';
import { render } from '@testing-library/react';
import { AXIS_ZLEVEL, normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getAxisCanvasEvents, getComponent, height, width } from 'test/panel';
import { type PanelOptions } from 'types';

// Canvas baselines of the histogram mode of the cartesian panel. The claims behind them (bucket bounds, bar
// widths, stacking and hidden series against the core buckets) are in `histogram.integration.test.tsx`.
//
// `editorMode: 'advanced'` keeps `animation.enabled` off, so the draw calls are deterministic.

const values = (
  fields: Record<string, number[]>,
  unit?: string,
  config: { min?: number; max?: number; custom?: Record<string, unknown> } = {}
): DataFrame =>
  toDataFrame({
    fields: [
      {
        name: 'time',
        type: FieldType.time,
        values: Object.values(fields)[0].map((_, i) => 1783137600000 + i * 60_000),
      },
      ...Object.entries(fields).map(([name, data]) => ({
        name,
        type: FieldType.number,
        values: data,
        config: { unit, ...config },
      })),
    ],
  });

const heights = [152, 158, 160, 161, 165, 165, 168, 170, 170, 171, 175, 177, 180, 181, 186, 199];
// A second group of heights, 7 mm taller, so the buckets of the two fields overlap.
const taller = heights.map((value) => value + 7);

const renderHistogram = async (frames: DataFrame[], options: Partial<PanelOptions> = {}) => {
  const { container } = render(
    getComponent(frames, 'bar', {
      zLevel: { series: SERIES_ZLEVEL, axis: AXIS_ZLEVEL },
      animation: { enabled: false },
      editorMode: 'advanced',
      histogram: true,
      ...options,
    })
  );
  return getAxisCanvasEvents(container);
};

describe('cartesian histogram', () => {
  it('draws automatic buckets of one field', async () => {
    const { defaultEvents, axisEvents, seriesEvents } = await renderHistogram([
      values({ Height: heights }, 'lengthmm'),
    ]);
    expect(normalizeCanvasEvents([...axisEvents, ...seriesEvents])).toMatchCanvasSnapshot(defaultEvents, {
      width,
      height,
    });
  });

  it('draws the buckets of two fields over each other', async () => {
    const { defaultEvents, axisEvents, seriesEvents } = await renderHistogram(
      [values({ Height: heights, Taller: taller })],
      {
        bucketSize: 10,
      }
    );
    expect(normalizeCanvasEvents([...axisEvents, ...seriesEvents])).toMatchCanvasSnapshot(defaultEvents, {
      width,
      height,
    });
  });

  it('stacks the buckets of two fields with Stacking Normal', async () => {
    const { defaultEvents, axisEvents, seriesEvents } = await renderHistogram(
      [values({ Height: heights, Taller: taller })],
      {
        bucketSize: 10,
        stacking: StackingMode.Normal,
      }
    );
    expect(normalizeCanvasEvents([...axisEvents, ...seriesEvents])).toMatchCanvasSnapshot(defaultEvents, {
      width,
      height,
    });
  });

  it('draws a pre-bucketed frame with an empty bucket', async () => {
    const frame = toDataFrame({
      fields: [
        { name: 'xMin', type: FieldType.number, values: [0, 100, 200, 300], config: { unit: 'ms' } },
        { name: 'xMax', type: FieldType.number, values: [100, 200, 300, 400], config: { unit: 'ms' } },
        { name: 'count', type: FieldType.number, values: [12, 30, 0, 5] },
      ],
    });
    const { defaultEvents, axisEvents, seriesEvents } = await renderHistogram([frame]);
    expect(normalizeCanvasEvents([...axisEvents, ...seriesEvents])).toMatchCanvasSnapshot(defaultEvents, {
      width,
      height,
    });
  });

  it('draws the buckets in the field min and max', async () => {
    const { defaultEvents, axisEvents, seriesEvents } = await renderHistogram(
      [values({ Height: heights }, undefined, { min: 157.5, max: 182 })],
      { bucketSize: 5 }
    );
    expect(normalizeCanvasEvents([...axisEvents, ...seriesEvents])).toMatchCanvasSnapshot(defaultEvents, {
      width,
      height,
    });
  });

  it('stacks two stacking groups of field settings on their own', async () => {
    const stacking = (group: string) => ({ custom: { stacking: { mode: StackingMode.Normal, group } } });
    const { defaultEvents, axisEvents, seriesEvents } = await renderHistogram(
      [
        values({ Height: heights, Taller: taller }, undefined, stacking('A')),
        values({ Shorter: heights.map((value) => value - 7) }, undefined, stacking('B')),
      ],
      { bucketSize: 10 }
    );
    expect(normalizeCanvasEvents([...axisEvents, ...seriesEvents])).toMatchCanvasSnapshot(defaultEvents, {
      width,
      height,
    });
  });

  it.each([GraphGradientMode.Opacity, GraphGradientMode.Hue])(
    'draws the %s gradient of the field settings, with a fill opacity and a line width',
    async (gradientMode) => {
      const { defaultEvents, axisEvents, seriesEvents } = await renderHistogram(
        [values({ Height: heights }, undefined, { custom: { gradientMode, fillOpacity: 60, lineWidth: 2 } })],
        { bucketSize: 5 }
      );
      expect(normalizeCanvasEvents([...axisEvents, ...seriesEvents])).toMatchCanvasSnapshot(defaultEvents, {
        width,
        height,
      });
    }
  );

  it('draws the named buckets of a heatmap-rows frame on an ordinal axis', async () => {
    const frame = toDataFrame({
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
    const { defaultEvents, axisEvents, seriesEvents } = await renderHistogram([frame]);
    expect(normalizeCanvasEvents([...axisEvents, ...seriesEvents])).toMatchCanvasSnapshot(defaultEvents, {
      width,
      height,
    });
  });
});
