import { type DataFrame, DataTopic, type FieldConfigSource, FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { type SeriesType } from 'editor/types';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent } from 'test/panel';

// Claims about the annotation marks of the cartesian panel, read from the drawn primitives.
// The baselines are in `annotations.canvas.test.tsx`.

const times = [1783137094497, 1783140694497, 1783144294497, 1783147894497];

const seriesFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: times },
    { name: 'cpu', type: FieldType.number, values: [10, 20, 30, 10] },
    { name: 'mem', type: FieldType.number, values: [15, 25, 5, 20] },
  ],
});

const annotationFrame = (overrides: Partial<DataFrame> = {}) =>
  toDataFrame({
    meta: { dataTopic: DataTopic.Annotations },
    fields: [
      { name: 'time', type: FieldType.time, values: [1783139000000, 1783143000000] },
      { name: 'timeEnd', type: FieldType.time, values: [null, 1783145500000] },
      { name: 'isRegion', type: FieldType.boolean, values: [false, true] },
      { name: 'color', type: FieldType.string, values: ['red', 'blue'] },
    ],
    ...overrides,
  });

// Legend click on "cpu": core's `hideSeriesFrom` override hides the first series in the viz.
const hideCpu: FieldConfigSource = {
  defaults: {},
  overrides: [
    {
      matcher: { id: 'byName', options: 'cpu' },
      properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: false } }],
    },
  ],
};

/** The annotation draw calls on the default layer: dashed strokes and translucent fills. */
const renderMarks = async (
  annotations: DataFrame[] | undefined,
  fieldConfig?: FieldConfigSource,
  frames: DataFrame[] = [seriesFrame],
  seriesType: SeriesType = 'line'
) => {
  const { container } = render(
    getComponent(
      frames,
      seriesType,
      { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false }, editorMode: 'advanced' },
      { annotations },
      undefined,
      'cartesian',
      fieldConfig
    )
  );
  const { defaultEvents, seriesEvents } = await getCanvasEvents(container);
  return {
    dashedStrokes: dashedStrokeXs(defaultEvents),
    fills: regionFills(defaultEvents),
    seriesStrokes: seriesEvents.filter((event) => event.type === 'stroke').length,
  };
};

/** The x of each stroke drawn with the [5, 5] dash. */
function dashedStrokeXs(events: CanvasRenderingContext2DEvent[]): number[] {
  const xs: number[] = [];
  let dashed = false;
  let lastMoveX: number | undefined;
  for (const event of events) {
    if (event.type === 'setLineDash') {
      dashed = JSON.stringify(event.props.segments) === '[5,5]';
    } else if (event.type === 'moveTo') {
      lastMoveX = event.props.x;
    } else if (event.type === 'stroke' && dashed && lastMoveX != null) {
      xs.push(lastMoveX);
    }
  }
  return xs;
}

/** The fill color of each fill drawn at the region opacity (0.1). */
function regionFills(events: CanvasRenderingContext2DEvent[]): string[] {
  const fills: string[] = [];
  let alpha = 1;
  let fillStyle = '';
  for (const event of events) {
    if (event.type === 'globalAlpha') {
      alpha = event.props.value;
    } else if (event.type === 'fillStyle') {
      fillStyle = event.props.value;
    } else if (event.type === 'fill' && alpha === 0.1) {
      fills.push(fillStyle);
    }
  }
  return fills;
}

describe('cartesian annotations', () => {
  it('draws one dashed line for a point and two for a region, and one band', async () => {
    const { dashedStrokes, fills } = await renderMarks([annotationFrame()]);
    expect(dashedStrokes).toHaveLength(3);
    expect(fills).toHaveLength(1);
  });

  it('draws nothing when the panel has no annotations', async () => {
    const { dashedStrokes, fills } = await renderMarks(undefined);
    expect(dashedStrokes).toEqual([]);
    expect(fills).toEqual([]);
  });

  it('keeps the marks when a legend click hides the first series', async () => {
    const shown = await renderMarks([annotationFrame()]);
    const hidden = await renderMarks([annotationFrame()], hideCpu);
    expect(shown.dashedStrokes).toHaveLength(3);
    // The override hides the series: the series layer draws fewer strokes.
    expect(hidden.seriesStrokes).toBeLessThan(shown.seriesStrokes);
    expect(hidden.dashedStrokes).toEqual(shown.dashedStrokes);
    expect(hidden.fills).toEqual(shown.fills);
  });

  it('colors each event with its theme color', async () => {
    const { fills } = await renderMarks([annotationFrame()]);
    // `blue` is the classic palette blue of the dark theme.
    expect(fills).toEqual(['#5794f2']);
  });

  it('draws no exemplar frame as an annotation', async () => {
    const { dashedStrokes, fills } = await renderMarks([annotationFrame({ name: 'exemplar' })]);
    expect(dashedStrokes).toEqual([]);
    expect(fills).toEqual([]);
  });
});

// OHLC rows at the times of `seriesFrame`.
const ohlcFrame = toDataFrame({
  name: 'BTC',
  fields: [
    { name: 'time', type: FieldType.time, values: times },
    { name: 'open', type: FieldType.number, values: [10, 18, 22, 15] },
    { name: 'high', type: FieldType.number, values: [20, 25, 28, 24] },
    { name: 'low', type: FieldType.number, values: [5, 12, 18, 11] },
    { name: 'close', type: FieldType.number, values: [18, 22, 15, 21] },
  ],
});

const pointsAt = (values: number[]) =>
  toDataFrame({
    meta: { dataTopic: DataTopic.Annotations },
    fields: [{ name: 'time', type: FieldType.time, values }],
  });

const hideOhlc: FieldConfigSource = {
  defaults: {},
  overrides: [
    {
      matcher: { id: 'byName', options: 'BTC' },
      properties: [{ id: 'custom.hideFrom', value: { viz: true, legend: false, tooltip: false } }],
    },
  ],
};

describe('candlestick annotations', () => {
  const renderCandles = (annotations: DataFrame[], fieldConfig?: FieldConfigSource) =>
    renderMarks(annotations, fieldConfig, [ohlcFrame], 'candlestick');

  it('draws a point between two candles at the nearest candle', async () => {
    // 1783139000000 is 1906 s after candle 0 and 1694 s before candle 1.
    const between = await renderCandles([pointsAt([1783139000000])]);
    const onCandle = await renderCandles([pointsAt([times[1]])]);
    expect(between.dashedStrokes).toHaveLength(1);
    expect(between.dashedStrokes).toEqual(onCandle.dashedStrokes);
  });

  it('draws a region between its nearest candles', async () => {
    const { dashedStrokes, fills } = await renderCandles([annotationFrame()]);
    // The point snaps to candle 1. The region (1783143000000 to 1783145500000) snaps to candle 2
    // at both edges, so it draws two lines at the same x.
    const edges = await renderCandles([pointsAt([times[1], times[2], times[2]])]);
    expect(dashedStrokes).toEqual(edges.dashedStrokes);
    expect(fills).toHaveLength(1);
  });

  it('drops a point out of the candles', async () => {
    const { dashedStrokes } = await renderCandles([pointsAt([times[0] - 1, times[3] + 1])]);
    expect(dashedStrokes).toEqual([]);
  });

  it('keeps the marks when a legend click hides the candles', async () => {
    const shown = await renderCandles([annotationFrame()]);
    const hidden = await renderCandles([annotationFrame()], hideOhlc);
    expect(hidden.seriesStrokes).toBeLessThan(shown.seriesStrokes);
    // The empty value axis has narrower labels, so the plot and the marks move: compare counts.
    expect(hidden.dashedStrokes).toHaveLength(3);
    expect(hidden.fills).toEqual(shown.fills);
  });
});

describe('panels with no core annotations', () => {
  it('draws no marks on a boxplot', async () => {
    const boxFrame = toDataFrame({
      fields: [
        { name: 'time', type: FieldType.time, values: times },
        { name: 'min', type: FieldType.number, values: [1, 2, 3, 4] },
        { name: 'q1', type: FieldType.number, values: [3, 4, 5, 6] },
        { name: 'median', type: FieldType.number, values: [5, 6, 7, 8] },
        { name: 'q3', type: FieldType.number, values: [7, 8, 9, 10] },
        { name: 'max', type: FieldType.number, values: [9, 10, 11, 12] },
      ],
    });
    const { dashedStrokes, fills } = await renderMarks([annotationFrame()], undefined, [boxFrame], 'boxplot');
    expect(dashedStrokes).toEqual([]);
    expect(fills).toEqual([]);
  });

  it('draws no marks on bars over a category axis, as core Bar chart', async () => {
    const categoryFrame = toDataFrame({
      fields: [
        { name: 'host', type: FieldType.string, values: ['a', 'b', 'c'] },
        { name: 'cpu', type: FieldType.number, values: [10, 20, 30] },
      ],
    });
    const { dashedStrokes, fills } = await renderMarks([annotationFrame()], undefined, [categoryFrame], 'bar');
    expect(dashedStrokes).toEqual([]);
    expect(fills).toEqual([]);
  });
});
