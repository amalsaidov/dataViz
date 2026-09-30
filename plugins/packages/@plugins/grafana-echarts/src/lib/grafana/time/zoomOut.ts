import { type AbsoluteTimeRange } from '@grafana/data';

/**
 * The range after a double click zoom out, as core time panels: the range is two times wider, around its center.
 * Core adds half the width on each side (`pad = (toTs - frTs) / 2`), and gives the range to `queryZoom`, which is
 * `onChangeTimeRange` of the panel.
 * https://github.com/grafana/grafana/blob/main/packages/grafana-ui/src/components/uPlot/plugins/TooltipPlugin2.tsx
 */
export function zoomOutTimeRange({ from, to }: AbsoluteTimeRange): AbsoluteTimeRange {
  const pad = (to - from) / 2;
  return { from: from - pad, to: to + pad };
}
