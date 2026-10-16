import { FieldType, toDataFrame, type DataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { type SeriesType } from 'editor/types';
import { type ChartFamily } from 'lib/echarts/charts/autoSeriesType';
import { getInstanceByDom } from 'lib/echarts/echarts';
import { doubleClickPlot } from 'test/doubleClick';
import { heatmapCanvasOptions, leRowsFrame } from 'test/heatmapCanvas';
import { defaultTimeRange, getComponent } from 'test/panel';
import { logVolumeFrame, streamCanvasOptions } from 'test/streamCanvas';
import { statusGridFrame, stringsFrame, timelineCanvasOptions } from 'test/timelineCanvas';
import { type PanelOptions } from 'types';

// A double click on the plot zooms the time range out, as core time panels: the range is two times wider around
// its center, through `onChangeTimeRange` (`queryZoom`).
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/plugins/TooltipPlugin2.tsx

const from = defaultTimeRange.from.valueOf();
const to = defaultTimeRange.to.valueOf();
const pad = (to - from) / 2;

const lineFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [0, 1, 2, 3].map((i) => from + (i * (to - from)) / 3) },
    { name: 'cpu', type: FieldType.number, values: [10, 40, 20, 50], config: { displayName: 'cpu' } },
  ],
});

const renderPanel = (
  frames: DataFrame[],
  seriesType: SeriesType,
  options: Partial<PanelOptions>,
  family: ChartFamily
) => {
  const onChangeTimeRange = jest.fn();
  const { container, unmount } = render(
    getComponent(frames, seriesType, options, undefined, { onChangeTimeRange }, family)
  );
  const chart = getInstanceByDom(container.querySelector<HTMLElement>('[_echarts_instance_]')!)!;
  return { chart, onChangeTimeRange, unmount };
};

const animationOff = { animation: { enabled: false } };

const families: Array<[string, DataFrame[], SeriesType, Partial<PanelOptions>, ChartFamily]> = [
  ['time series', [lineFrame], 'line', animationOff, 'cartesian'],
  ['heatmap', [leRowsFrame], 'heatmap', heatmapCanvasOptions(), 'heatmap'],
  ['state timeline', [stringsFrame()], 'custom', timelineCanvasOptions(), 'timeline'],
  ['status history', [statusGridFrame()], 'custom', timelineCanvasOptions(), 'status-history'],
  ['stream', [logVolumeFrame], 'themeRiver', streamCanvasOptions(), 'stream'],
];

describe('double click zoom out in the Grafana panel', () => {
  it.each(families)('%s: calls onChangeTimeRange with a range two times wider', (_, frames, type, options, family) => {
    const { chart, onChangeTimeRange, unmount } = renderPanel(frames, type, options, family);

    expect(doubleClickPlot(chart)).toBe(true);
    unmount();

    expect(onChangeTimeRange).toHaveBeenCalledTimes(1);
    expect(onChangeTimeRange).toHaveBeenCalledWith({ from: from - pad, to: to + pad });
  });

  it('ignores a double click with ctrl, as core', () => {
    const { chart, onChangeTimeRange, unmount } = renderPanel([lineFrame], 'line', animationOff, 'cartesian');

    doubleClickPlot(chart, { ctrlKey: true });
    unmount();

    expect(onChangeTimeRange).not.toHaveBeenCalled();
  });

  it('ignores a double click on a panel with no time axis', () => {
    const pieFrame = toDataFrame({
      fields: [
        { name: 'a', type: FieldType.number, values: [3] },
        { name: 'b', type: FieldType.number, values: [5] },
      ],
    });
    const { chart, onChangeTimeRange, unmount } = renderPanel([pieFrame], 'pie', animationOff, 'part-to-whole');

    doubleClickPlot(chart);
    unmount();

    expect(onChangeTimeRange).not.toHaveBeenCalled();
  });
});
