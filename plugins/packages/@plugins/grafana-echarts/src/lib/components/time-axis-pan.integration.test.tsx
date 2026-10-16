import { FieldType, toDataFrame } from '@grafana/data';
import { render } from '@testing-library/react';
import { getInstanceByDom } from 'lib/echarts/echarts';
import { defaultTimeRange, getComponent, height } from 'test/panel';
import { dragXAxis, msPerAxisPixel } from 'test/xAxisDrag';

// Viz contract 26.2, rule 6: in the Grafana panel, a drag of the x-axis labels calls `onChangeTimeRange` with the
// moved range, as core `XAxisInteractionAreaPlugin`.
// https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/plugins/XAxisInteractionAreaPlugin.tsx

const from = defaultTimeRange.from.valueOf();
const to = defaultTimeRange.to.valueOf();
const timeFrame = toDataFrame({
  fields: [
    { name: 'time', type: FieldType.time, values: [0, 1, 2, 3].map((i) => from + (i * (to - from)) / 3) },
    { name: 'cpu', type: FieldType.number, values: [10, 40, 20, 50], config: { displayName: 'cpu' } },
  ],
});

const renderPanel = (frame = timeFrame) => {
  const onChangeTimeRange = jest.fn();
  const { container, unmount } = render(
    getComponent([frame], 'line', { animation: { enabled: false } }, undefined, { onChangeTimeRange })
  );
  const chart = getInstanceByDom(container.querySelector<HTMLElement>('[_echarts_instance_]')!)!;
  return { chart, onChangeTimeRange, unmount };
};

describe('time axis pan in the Grafana panel', () => {
  // contract-rule: 26.2-rule-6-grafana-panel, 26.2-rule-1-time-axes
  it('calls onChangeTimeRange with the range moved by the drag', async () => {
    const { chart, onChangeTimeRange, unmount } = renderPanel();
    const perPixel = msPerAxisPixel(chart);

    dragXAxis(chart, 120, height);
    unmount();

    expect(onChangeTimeRange).toHaveBeenCalledTimes(1);
    const [range] = onChangeTimeRange.mock.calls[0];
    expect(range.from).toBeCloseTo(from - 120 * perPixel, -1);
    expect(range.to).toBeCloseTo(to - 120 * perPixel, -1);
  });

  it('moves the x axis during the drag, and puts it back after a drag of less than 5 px', async () => {
    const { chart, onChangeTimeRange, unmount } = renderPanel();

    dragXAxis(chart, 4, height);
    const [xAxis] = chart.getOption().xAxis as Array<{ min: number; max: number }>;
    unmount();

    expect(onChangeTimeRange).not.toHaveBeenCalled();
    expect({ from: xAxis.min, to: xAxis.max }).toEqual({ from, to });
  });
});
