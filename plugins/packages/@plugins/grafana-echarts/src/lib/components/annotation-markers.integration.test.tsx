import { type DataFrame, DataTopic, FieldType, toDataFrame } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { render, screen } from '@testing-library/react';
import { type EChartsType } from 'echarts';
import { type CanvasRenderingContext2DEvent } from 'jest-canvas-mock';
import { ANNOTATION_MARKER_SERIES_ID } from 'lib/echarts/options/annotationMarkers';
import { SERIES_ZLEVEL } from 'test/canvas';
import { getCanvasEvents, getComponent } from 'test/panel';
import { clickAt, dispatch, renderTooltipPanel, tooltipEl, tooltipText } from 'test/tooltipPointer';

// Claims about the annotation markers under the plot, as core `AnnotationMarker`: the drawn
// primitives, and the hover driven through zrender's real pointer pipeline (see
// `test/tooltipPointer.tsx`). A marker shows the annotation tooltip, and a data point still
// shows the data tooltip. The baseline is `annotation-markers.canvas.test.tsx`.

const times = [1783137094497, 1783140694497, 1783144294497, 1783147894497];

const seriesFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: times },
    { name: 'cpu', type: FieldType.number, values: [10, 20, 30, 10] },
  ],
});

const annotationFrame = toDataFrame({
  meta: { dataTopic: DataTopic.Annotations },
  fields: [
    { name: 'time', type: FieldType.time, values: [1783139000000, 1783143000000] },
    { name: 'timeEnd', type: FieldType.time, values: [null, 1783145500000] },
    { name: 'isRegion', type: FieldType.boolean, values: [false, true] },
    { name: 'color', type: FieldType.string, values: ['red', 'blue'] },
    { name: 'title', type: FieldType.string, values: ['Deploy', 'Maintenance'] },
    {
      name: 'text',
      type: FieldType.string,
      values: ['Version <b>1.2</b><script>window.injected = true</script>', 'Database upgrade'],
    },
    { name: 'tags', type: FieldType.other, values: [['release', 'api'], []] },
  ],
});

const renderPanel = (mode: TooltipDisplayMode, annotations: DataFrame[] = [annotationFrame]) =>
  renderTooltipPanel({
    frames: [seriesFrame],
    seriesType: 'line',
    family: 'cartesian',
    annotations,
    options: {
      zLevel: { series: SERIES_ZLEVEL },
      animation: { enabled: false },
      editorMode: 'advanced',
      tooltip: { mode, sort: SortOrder.None },
    },
  });

/** The bounding rect of the drawn marker at `dataIndex`, read off the chart rather than guessed. */
const markerRect = (chart: EChartsType, dataIndex: number): BoundingRect => {
  // `getOption()` types each component as `unknown`.
  const series = chart.getOption().series as Array<{ id?: string }>;
  const seriesIndex = series.findIndex((entry) => entry.id === ANNOTATION_MARKER_SERIES_ID);
  // ECharts' model internals are not part of the public typings; see `markPoint` in `test/tooltipPointer.tsx`.
  const model = chart as unknown as {
    getModel: () => {
      getSeriesByIndex: (index: number) => {
        getData: () => { getItemGraphicEl: (i: number) => { getBoundingRect: () => BoundingRect } };
      };
    };
  };
  return model.getModel().getSeriesByIndex(seriesIndex).getData().getItemGraphicEl(dataIndex).getBoundingRect();
};

/** A point in the drawn marker at `dataIndex`: its center, or `at` of its width. */
const markerCenter = (chart: EChartsType, dataIndex: number, at = 0.5): [number, number] => {
  const rect = markerRect(chart, dataIndex);
  return [rect.x + rect.width * at, rect.y + rect.height * 0.75];
};

interface BoundingRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** The pixel of the `cpu` value at `index`. */
const dataPoint = (chart: EChartsType, index: number): [number, number] => {
  const [x, y] = chart.convertToPixel({ seriesIndex: 0 }, [times[index], [10, 20, 30, 10][index]]);
  return [x, y];
};

const panelOptions = {
  zLevel: { series: SERIES_ZLEVEL },
  animation: { enabled: false },
  editorMode: 'advanced' as const,
};

/** The draw calls of the series layer, which holds the data line and the markers. */
const seriesLayer = async (annotations?: DataFrame[]) => {
  const { container } = render(getComponent([seriesFrame], 'line', panelOptions, { annotations }));
  return (await getCanvasEvents(container)).seriesEvents;
};

/** The path points of each fill, with its fill style. */
function fillPaths(events: CanvasRenderingContext2DEvent[]): Array<{ fill: string; points: number[][] }> {
  const paths: Array<{ fill: string; points: number[][] }> = [];
  let fill = '';
  let points: number[][] = [];
  for (const event of events) {
    if (event.type === 'beginPath') {
      points = [];
    } else if (event.type === 'fillStyle') {
      fill = event.props.value;
    } else if (event.type === 'moveTo' || event.type === 'lineTo') {
      points.push([event.props.x, event.props.y]);
    } else if (event.type === 'rect') {
      const { x, y, width, height } = event.props;
      points.push([x, y], [x + width, y + height]);
    } else if (event.type === 'fill') {
      paths.push({ fill, points });
    }
  }
  return paths;
}

/** The path points of each stroke with a `moveTo` or `lineTo` (the data line and its grid). */
function strokePaths(events: CanvasRenderingContext2DEvent[]): number[][][] {
  const paths: number[][][] = [];
  let points: number[][] = [];
  for (const event of events) {
    if (event.type === 'beginPath') {
      points = [];
    } else if (event.type === 'moveTo' || event.type === 'lineTo') {
      points.push([event.props.x, event.props.y]);
    } else if (event.type === 'stroke' && points.length > 0) {
      paths.push(points);
    }
  }
  return paths;
}

describe('annotation markers', () => {
  it('draws a 10 x 5 px triangle under the plot at a point, and a 5 px bar under a region', async () => {
    const chart = await renderPanel(TooltipDisplayMode.Single);
    const xOf = (time: number) => chart.convertToPixel({ gridIndex: 0 }, [time, 0])[0];
    const markerColors = ['#f2495c', '#5794f2'];
    const markers = fillPaths(await seriesLayer([annotationFrame])).filter(({ fill }) => markerColors.includes(fill));
    const bottom = markers[0].points[0][1];
    // `red` and `blue` are the classic palette colors of the dark theme.
    expect(markers).toEqual([
      {
        fill: '#f2495c',
        points: [
          [xOf(1783139000000), bottom],
          [xOf(1783139000000) - 5, bottom + 5],
          [xOf(1783139000000) + 5, bottom + 5],
        ],
      },
      {
        fill: '#5794f2',
        points: [
          [xOf(1783143000000), bottom],
          [xOf(1783145500000), bottom + 5],
        ],
      },
    ]);
    // The top of each marker is the bottom edge of the plot.
    expect(chart.containPixel({ gridIndex: 0 }, [xOf(1783139000000), bottom])).toBe(true);
    expect(chart.containPixel({ gridIndex: 0 }, [xOf(1783139000000), bottom + 1])).toBe(false);
  });

  it('does not change the data line', async () => {
    const withMarkers = await seriesLayer([annotationFrame]);
    const without = await seriesLayer(undefined);
    expect(fillPaths(withMarkers).length).toBeGreaterThan(fillPaths(without).length);
    expect(strokePaths(withMarkers)).toEqual(strokePaths(without));
  });
});

// OHLC rows at `times`: candlestick draws on a category axis of these times.
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

describe('candlestick annotation markers', () => {
  // A region from candle 1 to candle 3.
  const regionFrame = toDataFrame({
    meta: { dataTopic: DataTopic.Annotations },
    fields: [
      { name: 'time', type: FieldType.time, values: [times[1]] },
      { name: 'timeEnd', type: FieldType.time, values: [times[3]] },
      { name: 'isRegion', type: FieldType.boolean, values: [true] },
      { name: 'color', type: FieldType.string, values: ['blue'] },
    ],
  });
  const regionBar = async (seriesType: 'line' | 'candlestick', frame: DataFrame) => {
    const { container } = render(getComponent([frame], seriesType, panelOptions, { annotations: [regionFrame] }));
    const { seriesEvents } = await getCanvasEvents(container);
    return fillPaths(seriesEvents).filter(({ fill }) => fill === '#5794f2');
  };

  it('draws the region bar of the time series panel, from the edge candles', async () => {
    const [candle] = await regionBar('candlestick', ohlcFrame);
    const [line] = await regionBar('line', seriesFrame);
    const [[left, top], [right, bottom]] = candle.points;
    // The same 5 px bar under the plot as on the time axis.
    expect(bottom - top).toBe(5);
    expect(top).toBe(line.points[0][1]);
    // One bar with a width, from the second candle to the fourth.
    expect(right - left).toBeGreaterThan(0);
    expect(candle.points).toHaveLength(2);
  });
});

describe('annotation marker tooltip', () => {
  it.each([TooltipDisplayMode.Single, TooltipDisplayMode.Multi])(
    'shows the time, title, text and tags of a point in %s mode',
    async (mode) => {
      const chart = await renderPanel(mode);
      await dispatch(chart, 'mousemove', ...markerCenter(chart, 0));
      expect(tooltipText()).toContain('2026-07-04 04:23:20');
      expect(tooltipText()).toContain('Deploy');
      expect(tooltipText()).toContain('Version 1.2');
      expect(tooltipText()).toContain('release');
      expect(tooltipText()).toContain('api');
      expect(tooltipText()).not.toContain('cpu');
    }
  );

  it('sanitizes the text as HTML, as core', async () => {
    const chart = await renderPanel(TooltipDisplayMode.Single);
    await dispatch(chart, 'mousemove', ...markerCenter(chart, 0));
    expect(tooltipEl()?.querySelector('b')?.textContent).toBe('1.2');
    expect(tooltipEl()?.querySelector('script')).toBeNull();
  });

  it('shows the time range of a region', async () => {
    const chart = await renderPanel(TooltipDisplayMode.Single);
    await dispatch(chart, 'mousemove', ...markerCenter(chart, 1));
    expect(tooltipText()).toContain('2026-07-04 05:30:00 - 2026-07-04 06:11:40');
    expect(tooltipText()).toContain('Maintenance');
    expect(tooltipText()).toContain('Database upgrade');
  });

  it.each([TooltipDisplayMode.Single, TooltipDisplayMode.Multi])(
    'shows the data tooltip on a data point after a marker hover in %s mode',
    async (mode) => {
      const chart = await renderPanel(mode);
      await dispatch(chart, 'mousemove', ...markerCenter(chart, 0));
      expect(tooltipText()).toContain('Deploy');
      await dispatch(chart, 'mousemove', ...dataPoint(chart, 2));
      expect(tooltipText()).toContain('cpu');
      expect(tooltipText()).not.toContain('Deploy');
    }
  );

  it.each([TooltipDisplayMode.Single, TooltipDisplayMode.Multi])(
    'hides the marker tooltip when the cursor leaves the marker in %s mode',
    async (mode) => {
      const chart = await renderPanel(mode);
      const [x, y] = markerCenter(chart, 0);
      await dispatch(chart, 'mousemove', x, y);
      expect(tooltipText()).toContain('Deploy');
      // 40 px right of the point marker, on the axis labels: no marker and no data point.
      await dispatch(chart, 'mousemove', x + 40, y);
      await dispatch(chart, 'mousemove', x + 41, y);
      // The hide waits HIDE_DELAY_MS (120 ms); `dispatch` waits 50 ms each.
      await dispatch(chart, 'mousemove', x + 42, y);
      expect(tooltipText()).toBe('');
    }
  );

  it('pins the marker tooltip on a click, as core', async () => {
    const chart = await renderPanel(TooltipDisplayMode.Single);
    const [x, y] = markerCenter(chart, 0);
    await dispatch(chart, 'mousemove', x, y);
    await clickAt(chart, x, y);
    // A pinned tooltip has a close button, and a move off the marker keeps it.
    await dispatch(chart, 'mousemove', x + 40, y);
    await dispatch(chart, 'mousemove', x + 41, y);
    await dispatch(chart, 'mousemove', x + 42, y);
    expect(tooltipText()).toContain('Deploy');
    expect(tooltipEl()?.querySelector('[aria-label="Close"]')).not.toBeNull();
  });

  // The tooltip is a floating-ui `bottom` placement on the marker in core `AnnotationMarker`.
  describe('placement', () => {
    // jsdom lays nothing out: the chart container is at the window origin, and the tooltip has this size.
    const size = { width: 100, height: 60 };
    beforeEach(() => {
      jest.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(size.width);
      jest.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(size.height);
    });
    afterEach(() => jest.restoreAllMocks());

    /** The transform of a tooltip centered under `rect`. */
    const under = (rect: BoundingRect) =>
      `translateX(${rect.x + (rect.width - size.width) / 2}px) translateY(${rect.y + rect.height}px)`;

    it('puts the tooltip of a point under the marker, not at the cursor', async () => {
      const chart = await renderPanel(TooltipDisplayMode.Single);
      const rect = markerRect(chart, 0);
      await dispatch(chart, 'mousemove', ...markerCenter(chart, 0, 0.3));
      expect(tooltipEl()?.style.transform).toBe(under(rect));
      await dispatch(chart, 'mousemove', ...markerCenter(chart, 0, 0.7));
      expect(tooltipEl()?.style.transform).toBe(under(rect));
    });

    it('puts the tooltip of a region under the center of the region bar', async () => {
      const chart = await renderPanel(TooltipDisplayMode.Multi);
      const rect = markerRect(chart, 1);
      await dispatch(chart, 'mousemove', ...markerCenter(chart, 1, 0.1));
      expect(tooltipEl()?.style.transform).toBe(under(rect));
    });

    it('keeps the tooltip under the marker when a click pins it', async () => {
      const chart = await renderPanel(TooltipDisplayMode.Single);
      const [x, y] = markerCenter(chart, 0, 0.3);
      await dispatch(chart, 'mousemove', x, y);
      await clickAt(chart, x, y);
      expect(tooltipEl()?.querySelector('[aria-label="Close"]')).not.toBeNull();
      expect(tooltipEl()?.style.transform).toBe(under(markerRect(chart, 0)));
    });

    it('puts a data tooltip at the cursor after a marker hover', async () => {
      const chart = await renderPanel(TooltipDisplayMode.Single);
      await dispatch(chart, 'mousemove', ...markerCenter(chart, 0));
      const [x, y] = dataPoint(chart, 2);
      await dispatch(chart, 'mousemove', x, y);
      expect(tooltipText()).toContain('cpu');
      expect(tooltipEl()?.style.transform).not.toBe(under(markerRect(chart, 0)));
    });
  });

  it('shows the marker tooltip in Hidden mode, but no data tooltip, as core', async () => {
    const chart = await renderPanel(TooltipDisplayMode.None);
    await dispatch(chart, 'mousemove', ...dataPoint(chart, 2));
    expect(tooltipText()).toBe('');
    await dispatch(chart, 'mousemove', ...markerCenter(chart, 0));
    expect(tooltipText()).toContain('Deploy');
    expect(tooltipText()).not.toContain('cpu');
    await dispatch(chart, 'mousemove', ...markerCenter(chart, 1));
    expect(tooltipText()).toContain('Maintenance');
  });

  it('shows the data links of the annotation frame at the row of the event, as core', async () => {
    // A copy of each field, so the links stay out of the other tests.
    const withLinks = { ...annotationFrame, fields: annotationFrame.fields.map((field) => ({ ...field })) };
    const title = withLinks.fields.find((field) => field.name === 'title')!;
    title.config = { ...title.config, links: [{ title: 'Runbook', url: 'http://example.com' }] };
    // The host gives a field `getLinks` when it applies the field overrides (not Grafana 13.2, grafana/grafana#119619).
    title.getLinks = ({ valueRowIndex } = {}) => [
      { title: `Runbook ${valueRowIndex}`, href: 'http://example.com', target: '_self', origin: title },
    ];
    const chart = await renderPanel(TooltipDisplayMode.None, [withLinks]);
    await dispatch(chart, 'mousemove', ...markerCenter(chart, 1));
    expect(screen.getByRole('link', { name: /Runbook 1/ })).toBeInTheDocument();
    expect(tooltipText()).not.toContain('Runbook 0');
  });

  it('shows no footer for an annotation frame with no data links', async () => {
    const chart = await renderPanel(TooltipDisplayMode.Single);
    const [x, y] = markerCenter(chart, 0);
    await dispatch(chart, 'mousemove', x, y);
    await clickAt(chart, x, y);
    expect(tooltipEl()?.querySelectorAll('a')).toHaveLength(0);
    expect(screen.queryByRole('button', { name: 'Add annotation' })).not.toBeInTheDocument();
  });
});
