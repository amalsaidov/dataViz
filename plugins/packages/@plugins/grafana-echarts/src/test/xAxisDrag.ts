import { act } from '@testing-library/react';
import { type EChartsType } from 'lib/echarts/echarts';
import { isOnXAxisLabels } from 'lib/echarts/timePan';

/**
 * Drags the x-axis labels of `chart` by `dragPixels`, from the middle of the axis. The press goes through the real
 * ECharts handler, and the drag through the document mouse events, as a user drag does (`useTimeAxisPan`).
 * https://echarts.apache.org/en/api.html#echartsInstance.getZr
 */
export function dragXAxis(chart: EChartsType, dragPixels: number, height: number) {
  const [xAxis] = chart.getOption().xAxis as Array<{ min: number; max: number }>;
  const x = Number(chart.convertToPixel({ xAxisIndex: 0 }, (xAxis.min + xAxis.max) / 2));
  let y = 0;
  while (y < height && !isOnXAxisLabels(chart, x, y)) {
    y++;
  }
  expect(y).toBeLessThan(height);
  act(() => {
    chart.getZr().handler.dispatch('mousedown', { zrX: x, zrY: y });
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: x + dragPixels / 2 }));
    document.dispatchEvent(new MouseEvent('mousemove', { clientX: x + dragPixels }));
    document.dispatchEvent(new MouseEvent('mouseup', { clientX: x + dragPixels }));
  });
}

/** The time of one pixel of the drawn x axis of `chart`. */
export function msPerAxisPixel(chart: EChartsType): number {
  const [xAxis] = chart.getOption().xAxis as Array<{ min: number; max: number }>;
  const px = (time: number) => Number(chart.convertToPixel({ xAxisIndex: 0 }, time));
  return (xAxis.max - xAxis.min) / (px(xAxis.max) - px(xAxis.min));
}
