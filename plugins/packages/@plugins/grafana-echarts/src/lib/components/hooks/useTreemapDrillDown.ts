import { type ECElementEvent } from 'echarts/core';
import { type EChartsType } from 'lib/echarts/echarts';
import { treemapDrillDownNodeId, zoomTreemapToNode } from 'lib/echarts/treemapDrillDown';
import { useEffect } from 'react';

/**
 * Drill down in a treemap: a click on a parent node zooms to it. A leaf click is left to the
 * tooltip pin (`useEChartsTooltip`). A `null` chart binds no listener.
 * https://echarts.apache.org/en/api.html#events.Mouse%20events
 */
export function useTreemapDrillDown(chart: EChartsType | null): void {
  useEffect(() => {
    if (!chart) {
      return;
    }
    const onClick = (params: ECElementEvent) => {
      const id = treemapDrillDownNodeId(params);
      if (id !== undefined && params.seriesIndex != null) {
        zoomTreemapToNode(chart, params.seriesIndex, id);
      }
    };
    chart.on('click', onClick);
    return () => {
      // A disposed chart has no listeners (see `useBrushTimeZoom`).
      if (!chart.isDisposed()) {
        chart.off('click', onClick);
      }
    };
  }, [chart]);
}
