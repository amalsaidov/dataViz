import { type DataFrame, DataTopic, FieldType, toDataFrame } from '@grafana/data';
import { SortOrder, TooltipDisplayMode } from '@grafana/schema';
import { render } from '@testing-library/react';
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

const renderPanel = (mode: TooltipDisplayMode) =>
  renderTooltipPanel({
    frames: [seriesFrame],
    seriesType: 'line',
    family: 'cartesian',
    annotations: [annotationFrame],
    options: {
      zLevel: { series: SERIES_ZLEVEL },
      animation: { enabled: false },
      editorMode: 'advanced',
      tooltip: { mode, sort: SortOrder.None },
    },
  });

/** The center of the drawn marker at `dataIndex`, read off the chart rather than guessed. */
const markerCenter = (chart: EChartsType, dataIndex: number): [number, number] => {
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
  const rect = model.getModel().getSeriesByIndex(seriesIndex).getData().getItemGraphicEl(dataIndex).getBoundingRect();
  return [rect.x + rect.width / 2, rect.y + rect.height * 0.75];
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
});
