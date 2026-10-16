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

/**
 * The node id of a `treemapRootToNode` action: a header click gives `targetNodeId`, and a
 * breadcrumb click gives the `targetNode` tree node. Else `undefined`.
 * https://echarts.apache.org/en/api.html#events.treemapRootToNode
 */
export function treemapRootNodeId(payload: unknown): string | undefined {
  if (payload == null || typeof payload !== 'object') {
    return undefined;
  }
  if ('targetNodeId' in payload && typeof payload.targetNodeId === 'string') {
    return payload.targetNodeId;
  }
  const node = 'targetNode' in payload ? payload.targetNode : undefined;
  if (node != null && typeof node === 'object' && 'getId' in node && typeof node.getId === 'function') {
    const id: unknown = Reflect.apply(node.getId, node, []);
    return typeof id === 'string' ? id : undefined;
  }
  return undefined;
}

/**
 * Set the view root again on each treemap series after a `notMerge` `setOption`, which resets
 * it. ECharts ignores an id that the new data does not have.
 * https://echarts.apache.org/en/api.html#action.treemap.treemapRootToNode
 */
export function restoreTreemapRoot(chart: EChartsType, option: object, targetNodeId: string): void {
  const raw = 'series' in option ? option.series : undefined;
  const series: unknown[] = raw == null ? [] : Array.isArray(raw) ? raw : [raw];
  series.forEach((s, seriesIndex) => {
    if (s != null && typeof s === 'object' && 'type' in s && s.type === 'treemap') {
      zoomTreemapToNode(chart, seriesIndex, targetNodeId);
    }
  });
}
