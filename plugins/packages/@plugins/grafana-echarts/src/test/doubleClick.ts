import { act } from '@testing-library/react';
import { type EChartsType } from 'lib/echarts/echarts';
import { isInPlotArea } from 'lib/echarts/plotArea';

/**
 * Double clicks the first point of the plot area of `chart`, on a diagonal from the top left, through the real
 * zrender handler. With no plot area, it double clicks the center. It returns false when it found no plot area.
 * https://echarts.apache.org/en/api.html#echartsInstance.getZr
 */
export function doubleClickPlot(chart: EChartsType, init: MouseEventInit = {}): boolean {
  const width = chart.getWidth();
  const height = chart.getHeight();
  let point: [number, number] | undefined;
  for (let i = 0; i < 1 && point === undefined; i += 0.02) {
    const x = Math.round(width * (0.25 + i / 2));
    const y = Math.round(height * i);
    if (isInPlotArea(chart, x, y)) {
      point = [x, y];
    }
  }
  const [zrX, zrY] = point ?? [width / 2, height / 2];
  // zrender gives this object to the listeners as `event.event`, as it does with a native event.
  const event = Object.assign(new MouseEvent('dblclick', init), { zrX, zrY });
  act(() => {
    chart.getZr().handler.dispatch('dblclick', event);
  });
  return point !== undefined;
}
