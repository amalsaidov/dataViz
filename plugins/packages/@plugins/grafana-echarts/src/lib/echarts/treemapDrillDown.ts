import { type ECElementEvent } from 'echarts/core';
import { type EChartsType } from 'lib/echarts/echarts';

// The ECharts side of the treemap drill down: a click on a parent node zooms to it, and a click
// on a leaf pins the tooltip. The zoom is view-only (contract 4.5 item 6). Grafana-free, so the
// standalone renderer uses it too.

/**
 * The node id to zoom to when a pointer event is on a treemap parent node, else `undefined`.
 * The id is the one `toTreeData` sets.
 * https://echarts.apache.org/en/api.html#events.Mouse%20events
 */
export function treemapDrillDownNodeId(params: ECElementEvent | null | undefined): string | undefined {
  if (params?.seriesType !== 'treemap') {
    return undefined;
  }
  const data: unknown = params.data;
  if (data == null || typeof data !== 'object' || !('id' in data) || !('children' in data)) {
    return undefined;
  }
  const { id, children } = data;
  return typeof id === 'string' && Array.isArray(children) && children.length > 0 ? id : undefined;
}

/**
 * Make a node the root of the treemap view. ECharts then shows the node's path in the
 * breadcrumb. `treemapRootToNode`, not `treemapZoomToNode`: the zoom action changes only the
 * current frame, so the next view update undoes it.
 * https://echarts.apache.org/en/api.html#action.treemap.treemapRootToNode
 */
export function zoomTreemapToNode(chart: EChartsType, seriesIndex: number, targetNodeId: string): void {
  chart.dispatchAction({ type: 'treemapRootToNode', seriesIndex, targetNodeId });
}
