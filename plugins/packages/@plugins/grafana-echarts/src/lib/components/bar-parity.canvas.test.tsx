import { type DataFrame, FieldColorModeId, FieldType, toDataFrame } from '@grafana/data';
import { GraphTransform, StackingMode, VizOrientation } from '@grafana/schema';
import { render } from '@testing-library/react';
import { normalizeCanvasEvents, SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent, height, width } from 'test/panel';
import { type PanelOptions } from 'types';

// Canvas baselines of the core Bar chart parity rules on cartesian bars: stacking
// with negative values, 100% stacking, horizontal bars, per-bar threshold colors,
// "Negative Y" with the value-end radius, and bars stacked from two time frames.
// The claims behind them (label texts, fills, bar shapes) are stated per option
// in `integration-tests/bars/`.
//
// `editorMode: 'advanced'` is required — in Default mode
// `applyCartesianEditorModeDefaults` resets `animation.enabled` back on and the
// draw calls stop being deterministic.

const categoryFrame = (fields: Array<{ name: string; values: number[]; config?: object }>) =>
  toDataFrame({
    fields: [
      { name: 'category', type: FieldType.string, values: ['Q1', 'Q2', 'Q3', 'Q4'] },
      ...fields.map((field) => ({ type: FieldType.number, config: {}, ...field })),
    ],
  });

const renderBars = async (frames: DataFrame[], options: Partial<PanelOptions> = {}) => {
  const { container } = render(
    getComponent(frames, 'bar', {
      zLevel: { series: SERIES_ZLEVEL },
      animation: { enabled: false },
      editorMode: 'advanced',
      showValues: 'always',
      ...options,
    })
  );
  return getCanvasEvents(container);
};

const gainLoss = () =>
  categoryFrame([
    { name: 'Gain', values: [40, 25, -8, 50] },
    { name: 'Loss', values: [-12, -30, -5, -20] },
  ]);

describe('cartesian bars: core Bar chart parity', () => {
  it('stacks positive and negative values apart, with labels past each bar end', async () => {
    const { defaultEvents, seriesEvents } = await renderBars([gainLoss()], { stacking: StackingMode.Normal });
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('fills the axis with each stack in 100% stacking', async () => {
    const frame = categoryFrame([
      { name: 'Budget', values: [110, 102, 130, 105] },
      { name: 'Actual', values: [125, 98, 121, 112] },
    ]);
    const { defaultEvents, seriesEvents } = await renderBars([frame], { stacking: StackingMode.Percent });
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('draws horizontal bars, first category at the top', async () => {
    const frame = categoryFrame([
      { name: 'Budget', values: [110, 102, 130, 105] },
      { name: 'Actual', values: [125, 98, 121, 112] },
    ]);
    const { defaultEvents, seriesEvents } = await renderBars([frame], { orientation: VizOrientation.Horizontal });
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('fills each bar from its threshold step', async () => {
    const thresholds = {
      mode: 'absolute',
      steps: [
        { value: -Infinity, color: 'blue' },
        { value: 106, color: 'orange' },
        { value: 120, color: 'red' },
      ],
    };
    const frame = categoryFrame([
      {
        name: 'Budget',
        values: [110, 102, 130, 105],
        config: { color: { mode: FieldColorModeId.Thresholds }, thresholds },
      },
    ]);
    const { defaultEvents, seriesEvents } = await renderBars([frame]);
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('draws a "Negative Y" field below zero with the value end rounded', async () => {
    const frame = categoryFrame([
      { name: 'Gain', values: [40, 25, 18, 50] },
      { name: 'Loss', values: [12, 30, 5, 20], config: { custom: { transform: GraphTransform.NegativeY } } },
    ]);
    const { defaultEvents, seriesEvents } = await renderBars([frame], { barRadius: 6 });
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });

  it('stacks bars from two time frames on their shared timestamps', async () => {
    const hour = 60 * 60 * 1000;
    const start = 1783137600000;
    const timeFrame = (name: string, hours: number[], values: number[]) =>
      toDataFrame({
        fields: [
          { name: 'time', type: FieldType.time, values: hours.map((h) => start + h * hour) },
          { name, type: FieldType.number, values },
        ],
      });
    const frames = [timeFrame('A', [0.5, 1, 1.5, 2], [10, 20, 15, 25]), timeFrame('B', [1, 1.5, 2, 2.5], [5, 8, 6, 9])];
    const { defaultEvents, seriesEvents } = await renderBars(frames, { stacking: StackingMode.Normal });
    expect(normalizeCanvasEvents(seriesEvents)).toMatchCanvasSnapshot(defaultEvents, { width, height });
  });
});
