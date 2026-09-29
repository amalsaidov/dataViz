import { type DataFrame, DataTopic, FieldType, toDataFrame } from '@grafana/data';
import { type VizAnnotations } from '@grafana/schema';
import { render } from '@testing-library/react';
import { type EChartsType } from 'echarts';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { ANNOTATION_MARKER_SERIES_ID } from 'lib/echarts/options/annotationMarkers';
import { getChart, SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent } from 'test/panel';

// Claims about the core annotation panel options (`options.annotations`) on the cartesian panel,
// read from the drawn primitives: the line width, the band opacity, "Hide lines and areas" and
// "Enable multi-row annotations". The baselines are in `annotation-options.canvas.test.tsx`.

const times = [1783137094497, 1783140694497, 1783144294497, 1783147894497];

const seriesFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: times },
    { name: 'cpu', type: FieldType.number, values: [10, 20, 30, 10] },
  ],
});

// Two annotation frames, as two dashboard annotation queries give: points, then a region.
const pointFrame = toDataFrame({
  meta: { dataTopic: DataTopic.Annotations },
  fields: [
    { name: 'time', type: FieldType.time, values: [1783139000000] },
    { name: 'color', type: FieldType.string, values: ['red'] },
  ],
});
const regionFrame = toDataFrame({
  meta: { dataTopic: DataTopic.Annotations },
  fields: [
    { name: 'time', type: FieldType.time, values: [1783143000000] },
    { name: 'timeEnd', type: FieldType.time, values: [1783145500000] },
    { name: 'isRegion', type: FieldType.boolean, values: [true] },
    { name: 'color', type: FieldType.string, values: ['blue'] },
  ],
});

const renderAnnotations = async (annotations: VizAnnotations | undefined, frames: DataFrame[]) => {
  const { container } = render(
    getComponent(
      [seriesFrame],
      'line',
      { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false }, editorMode: 'advanced', annotations },
      { annotations: frames }
    )
  );
  const { defaultEvents } = await getCanvasEvents(container);
  const { chart } = getChart(container);
  if (!chart) {
    throw new Error('no chart');
  }
  return { ...dashedStrokes(defaultEvents), chart };
};

/** The line width of each stroke with the [5, 5] dash, and the alpha of each fill in a dash-free path. */
function dashedStrokes(events: CanvasRenderingContext2DEvent[]) {
  const widths: number[] = [];
  const bandAlphas: number[] = [];
  let dashed = false;
  let lineWidth = 1;
  let alpha = 1;
  for (const event of events) {
    if (event.type === 'setLineDash') {
      dashed = JSON.stringify(event.props.segments) === '[5,5]';
    } else if (event.type === 'lineWidth') {
      lineWidth = event.props.value;
    } else if (event.type === 'globalAlpha') {
      alpha = event.props.value;
    } else if (event.type === 'stroke' && dashed) {
      widths.push(lineWidth);
    } else if (event.type === 'fill' && alpha < 1) {
      bandAlphas.push(alpha);
    }
  }
  return { widths, bandAlphas };
}

interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The drawn rect of each annotation marker, read off the chart model. */
const markerRects = (chart: EChartsType): BoundingRect[] => {
  // `getOption()` types each component as `unknown`.
  const series = chart.getOption().series as Array<{ id?: string; data?: unknown[] }>;
  const seriesIndex = series.findIndex((entry) => entry.id === ANNOTATION_MARKER_SERIES_ID);
  // ECharts' model internals are not part of the public typings; see `annotation-markers.integration.test.tsx`.
  const model = chart as unknown as {
    getModel: () => {
      getSeriesByIndex: (index: number) => {
        getData: () => {
          count: () => number;
          getItemGraphicEl: (i: number) => { getBoundingRect: () => BoundingRect };
        };
      };
    };
  };
  const data = model.getModel().getSeriesByIndex(seriesIndex).getData();
  return Array.from({ length: data.count() }, (_, index) => data.getItemGraphicEl(index).getBoundingRect());
};

/** The y of the bottom edge of the plot, from the grid rect of the chart model. */
const plotBottom = (chart: EChartsType) => {
  // ECharts' model internals are not part of the public typings.
  const model = chart as unknown as {
    getModel: () => { getComponent: (type: string) => { coordinateSystem: { getRect: () => BoundingRect } } };
  };
  const rect = model.getModel().getComponent('grid').coordinateSystem.getRect();
  return rect.y + rect.height;
};

describe('annotation line width and band opacity', () => {
  it('draws the core defaults when the panel has no annotation options', async () => {
    const { widths, bandAlphas } = await renderAnnotations(undefined, [pointFrame, regionFrame]);
    expect(widths).toEqual([2, 2, 2]);
    expect(bandAlphas).toEqual([0.1]);
  });

  it('draws the lines at `lines.width` and the band at `regions.opacity`', async () => {
    const { widths, bandAlphas } = await renderAnnotations({ lines: { width: 4 }, regions: { opacity: 0.3 } }, [
      pointFrame,
      regionFrame,
    ]);
    expect(widths).toEqual([4, 4, 4]);
    expect(bandAlphas).toEqual([0.3]);
  });

  it('hides the lines and the band but keeps the markers ("Hide lines and areas")', async () => {
    const { widths, bandAlphas, chart } = await renderAnnotations({ lines: { width: 0 }, regions: { opacity: 0 } }, [
      pointFrame,
      regionFrame,
    ]);
    expect(widths).toEqual([]);
    expect(bandAlphas).toEqual([]);
    expect(markerRects(chart)).toHaveLength(2);
  });
});

describe('multi-row annotations', () => {
  it('draws the markers of the second frame one lane (7 px) under the first', async () => {
    const single = markerRects((await renderAnnotations(undefined, [pointFrame, regionFrame])).chart);
    const multi = markerRects((await renderAnnotations({ multiLane: true }, [pointFrame, regionFrame])).chart);
    expect(single[1].y - single[0].y).toBe(0);
    expect(multi[1].y - multi[0].y).toBe(7);
  });

  it('puts the first lane at the plot bottom, and moves the plot up to make room for the lanes', async () => {
    const single = await renderAnnotations(undefined, [pointFrame, regionFrame]);
    const multi = await renderAnnotations({ multiLane: true }, [pointFrame, regionFrame]);
    expect(markerRects(multi.chart)[0].y).toBeCloseTo(plotBottom(multi.chart), 0);
    // The axis label margin grows by two lanes of 7 px, so the plot bottom moves up by 14 px.
    expect(plotBottom(single.chart) - plotBottom(multi.chart)).toBeCloseTo(14, 0);
  });

  it('keeps the plot bottom for one annotation frame, as core `getXAxisConfig` (2 or more lanes)', async () => {
    const single = await renderAnnotations(undefined, [pointFrame]);
    const multi = await renderAnnotations({ multiLane: true }, [pointFrame]);
    expect(plotBottom(multi.chart)).toBeCloseTo(plotBottom(single.chart), 0);
    expect(markerRects(multi.chart)[0].y).toBeCloseTo(markerRects(single.chart)[0].y, 0);
  });

  it('draws no lines and no band until the panel sets them, as core', async () => {
    const hidden = await renderAnnotations({ multiLane: true }, [pointFrame, regionFrame]);
    expect(hidden.widths).toEqual([]);
    expect(hidden.bandAlphas).toEqual([]);
    const shown = await renderAnnotations({ multiLane: true, lines: { width: 2 }, regions: { opacity: 0.1 } }, [
      pointFrame,
      regionFrame,
    ]);
    expect(shown.widths).toEqual([2, 2, 2]);
    expect(shown.bandAlphas).toEqual([0.1]);
  });
});

describe('candlestick annotation options', () => {
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

  const renderCandles = async (annotations: VizAnnotations) => {
    const { container } = render(
      getComponent(
        [ohlcFrame],
        'candlestick',
        { zLevel: { series: SERIES_ZLEVEL }, animation: { enabled: false }, editorMode: 'advanced', annotations },
        { annotations: [pointFrame, regionFrame] }
      )
    );
    return dashedStrokes((await getCanvasEvents(container)).defaultEvents);
  };

  it('reads the line width and the band opacity', async () => {
    const { widths, bandAlphas } = await renderCandles({ lines: { width: 4 }, regions: { opacity: 0.3 } });
    expect(widths).toEqual([4, 4, 4]);
    expect(bandAlphas).toEqual([0.3]);
  });

  it('hides the lines and the band', async () => {
    const { widths, bandAlphas } = await renderCandles({ lines: { width: 0 }, regions: { opacity: 0 } });
    expect(widths).toEqual([]);
    expect(bandAlphas).toEqual([]);
  });
});
