import { type EChartsType } from 'lib/echarts/echarts';

/**
 * True when `[x, y]` is in the plot area: the first cartesian grid, or the first single axis (the stream family).
 * The string finder `'singleAxis'` means `{ singleAxisIndex: 0 }`.
 * https://echarts.apache.org/en/api.html#echartsInstance.containPixel
 */
export function isInPlotArea(chart: EChartsType, x: number, y: number): boolean {
  if (chart.isDisposed()) {
    return false;
  }
  return chart.containPixel({ gridIndex: 0 }, [x, y]) || chart.containPixel('singleAxis', [x, y]);
}
