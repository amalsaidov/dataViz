import { type PanelProps } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { type ChartFamily } from 'lib/echarts/charts/autoSeriesType';
import React from 'react';

interface PanelRenderErrorViewProps {
  family: ChartFamily;
  panel: PanelProps;
}

// The name of the chart kind of each family, for the error message.
const CHART_NAMES: Record<ChartFamily, string> = {
  cartesian: 'cartesian chart',
  heatmap: 'heatmap',
  'part-to-whole': 'part-to-whole chart',
  multivariate: 'multivariate chart',
  hierarchy: 'hierarchy chart',
  relations: 'relations chart',
  stream: 'stream chart',
  geo: 'geo map',
  timeline: 'state timeline',
  'status-history': 'status history',
};

/** The message for a render error. The raw error text goes to the console only. */
export const renderErrorMessage = (family: ChartFamily) => `This data can't be shown as a ${CHART_NAMES[family]}.`;

/**
 * The view of the Grafana panel when the chart throws while it renders. It shows the error view of Grafana with a
 * generic message, and sets `data-viz-state` to `error` (viz contract 4.4, row 9: `render-error`).
 * https://github.com/grafana/grafana/blob/main/packages/grafana-runtime/src/components/PanelDataErrorView.tsx
 */
export const PanelRenderErrorView = ({ family, panel }: PanelRenderErrorViewProps) => (
  <div data-viz-state="error" style={{ width: '100%', height: '100%' }}>
    <PanelDataErrorView
      panelId={panel.id}
      fieldConfig={panel.fieldConfig}
      data={panel.data}
      message={renderErrorMessage(family)}
    />
  </div>
);
