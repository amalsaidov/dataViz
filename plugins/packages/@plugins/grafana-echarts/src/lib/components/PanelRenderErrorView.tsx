import { type PanelProps } from '@grafana/data';
import { PanelDataErrorView } from '@grafana/runtime';
import { type ChartFamily } from 'lib/echarts/charts/autoSeriesType';
import React from 'react';
import { renderErrorMessage } from './renderErrorMessage';

interface PanelRenderErrorViewProps {
  family: ChartFamily;
  panel: PanelProps;
}

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
