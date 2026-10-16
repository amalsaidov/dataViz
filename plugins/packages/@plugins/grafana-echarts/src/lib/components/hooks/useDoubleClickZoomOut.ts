import { type AbsoluteTimeRange } from '@grafana/data';
import { type EChartsType } from 'lib/echarts/echarts';
import { isInPlotArea } from 'lib/echarts/plotArea';
import { zoomOutTimeRange } from 'lib/grafana/time/zoomOut';
import { useEffect, useRef } from 'react';

/**
 * Zoom out with a double click on the plot area, as core time panels. Core skips a double click with ctrl or
 * cmd (`maybeZoomAction`).
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/plugins/TooltipPlugin2.tsx
 *
 * With `zoomOut`, the host zooms out (`TimeZoomOutContext`). With no `zoomOut`, the hook calls `onChangeTimeRange`
 * with the wider `range`. A `null` chart binds no listener. The handler reads the latest values through a ref.
 * https://echarts.apache.org/en/api.html#events.Mouse%20events
 */
export function useDoubleClickZoomOut(
  chart: EChartsType | null,
  range: AbsoluteTimeRange,
  onChangeTimeRange: (timeRange: AbsoluteTimeRange) => void,
  zoomOut?: () => void
): void {
  const latest = useRef({ range, onChangeTimeRange, zoomOut });
  useEffect(() => {
    latest.current = { range, onChangeTimeRange, zoomOut };
  }, [range, onChangeTimeRange, zoomOut]);

  useEffect(() => {
    if (!chart) {
      return;
    }
    const zr = chart.getZr();
    const onDoubleClick = (event: { offsetX: number; offsetY: number; event?: Event }) => {
      const e = event.event;
      if ((e instanceof MouseEvent && (e.ctrlKey || e.metaKey)) || !isInPlotArea(chart, event.offsetX, event.offsetY)) {
        return;
      }
      const { zoomOut, onChangeTimeRange, range } = latest.current;
      if (zoomOut !== undefined) {
        zoomOut();
      } else {
        onChangeTimeRange(zoomOutTimeRange(range));
      }
    };
    zr.on('dblclick', onDoubleClick);
    return () => {
      // A disposed chart has no listeners (see `useBrushTimeZoom`).
      if (!chart.isDisposed()) {
        zr.off('dblclick', onDoubleClick);
      }
    };
  }, [chart]);
}
